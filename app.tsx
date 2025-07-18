

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Crop, Expense, ChecklistItem, PlantingType, Language, Project, CompletedTasks } from './types';
import type { Chat } from '@google/genai';
import { CROPS, PLANTING_TYPES, CATALOG_ITEMS, WEEDS } from './constants';
import { generateWeeklyChecklist, createChatSession, sendMessage } from './services/geminiService';
import { t } from './i18n';
import PlannerCard from './components/PlannerCard';
import ExpenseTrackerCard from './components/ExpenseTrackerCard';
import RoiCard from './components/RoiCard';
import ChecklistCard from './components/ChecklistCard';
import TanyaAiCard from './components/TanyaAiCard';
import CatalogCard from './components/CatalogCard';
import PlantInfoCard from './components/PlantInfoCard';
import GulmaCard from './components/GulmaCard';
import ProjectDashboard from './components/ProjectDashboard';
import { LogoIcon, ClipboardListIcon, PlantAnalysisIcon, GlobeIcon, CatalogIcon, SproutIcon, WeedIcon, BriefcaseIcon } from './components/IconComponents';
import { ProjectControls } from './components/ProjectControls';


type View = 'projects' | 'planner' | 'plant' | 'gulma' | 'catalog' | 'tanyaAi';
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    media?: {
        data: string;
        mimeType: string;
    };
}

const App: React.FC = () => {
  // Language State
  const [language, setLanguage] = useState<Language>('id');
  
  // View State
  const [activeView, setActiveView] = useState<View>('projects');

  // Project State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Core App State (Planner State)
  const [selectedCrop, setSelectedCrop] = useState<Crop>(CROPS[0]);
  const [plantingType, setPlantingType] = useState<PlantingType>('field');
  const [plantingDate, setPlantingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expectedYield, setExpectedYield] = useState<number>(5000); // in kg
  const [marketPrice, setMarketPrice] = useState<number>(4500); // in IDR per kg
  
  const [rawTasks, setRawTasks] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTasks>({});
  const [isLoadingChecklist, setIsLoadingChecklist] = useState<boolean>(true);
  const [checklistCache, setChecklistCache] = useState<Record<string, string[]>>({});


  // State for Tanya AI
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [uploadedMedia, setUploadedMedia] = useState<{data: string; mimeType: string} | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [aiChatSession, setAiChatSession] = useState<Chat | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string>('');
  
  // State for Plant Info View
  const [viewingCropId, setViewingCropId] = useState<string>(selectedCrop.id);
  
  // Ref for debouncing checklist fetch
  const fetchChecklistTimeout = useRef<number | null>(null);

  // Derived State
  const totalExpenses = useMemo(() => {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  }, [expenses]);

  const currentWeek = useMemo(() => {
    if (!plantingDate) return 1;
    const now = new Date();
    const start = new Date(plantingDate);
    if (now < start) return 1;
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.min(selectedCrop.avgGrowthWeeks, Math.ceil(diffDays / 7)));
  }, [plantingDate, selectedCrop]);

  const [selectedChecklistWeek, setSelectedChecklistWeek] = useState<number>(currentWeek);

  const checklist = useMemo<ChecklistItem[]>(() => {
    return rawTasks.map((task, index) => {
        const taskId = `${selectedCrop.id}-${selectedChecklistWeek}-${index}`;
        return {
            id: taskId,
            task,
            completed: !!completedTasks[taskId]
        };
    });
  }, [rawTasks, completedTasks, selectedCrop.id, selectedChecklistWeek]);
  
  const currentProjectName = useMemo(() => {
    if (!currentProjectId) return null;
    return projects.find(p => p.id === currentProjectId)?.name || null;
  }, [currentProjectId, projects]);

  // Effects for Data Persistence
  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem('taniCerdasProjects');
      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      }
    } catch (error) {
      console.error("Failed to load projects from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('taniCerdasProjects', JSON.stringify(projects));
    } catch (error) {
      console.error("Failed to save projects to localStorage", error);
    }
  }, [projects]);


  useEffect(() => {
    setSelectedChecklistWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    setViewingCropId(selectedCrop.id);
  }, [selectedCrop.id]);

  // Handlers
  const handleAddExpense = (description: string, amount: number, date: string) => {
    const newExpense: Expense = {
      id: new Date().toISOString(),
      description,
      amount,
      date,
    };
    setExpenses(prev => [...prev, newExpense]);
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== id));
  };
  
  const handleToggleChecklistItem = (id: string) => {
    setCompletedTasks(prev => {
        const newCompleted = { ...prev };
        newCompleted[id] = !newCompleted[id];
        return newCompleted;
    });
  };

  useEffect(() => {
    if (fetchChecklistTimeout.current) {
        clearTimeout(fetchChecklistTimeout.current);
    }

    setIsLoadingChecklist(true);

    fetchChecklistTimeout.current = window.setTimeout(async () => {
        if (!selectedCrop) {
            setIsLoadingChecklist(false);
            return;
        }

        const cacheKey = `${selectedCrop.id}-${selectedChecklistWeek}-${plantingType}-${language}`;
        if (checklistCache[cacheKey]) {
            setRawTasks(checklistCache[cacheKey]);
            setIsLoadingChecklist(false);
            return;
        }

        try {
            const plantingTypeName = PLANTING_TYPES.find(p => p.id === plantingType)?.name[language] || plantingType;
            const tasks = await generateWeeklyChecklist(selectedCrop.name[language], selectedChecklistWeek, plantingTypeName, language);
            setRawTasks(tasks);
            setChecklistCache(prev => ({ ...prev, [cacheKey]: tasks }));
        } catch (error) {
            console.error("Error generating checklist:", error);
            let friendlyMessage = t('checklistError', language);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);

            if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429")) {
                friendlyMessage = t('checklistRateLimitError', language);
            } else if (error instanceof Error) {
                friendlyMessage = errorMessage;
            }
            setRawTasks([friendlyMessage]);
        } finally {
            setIsLoadingChecklist(false);
        }
    }, 500); // 500ms debounce delay

    return () => {
        if (fetchChecklistTimeout.current) {
            clearTimeout(fetchChecklistTimeout.current);
        }
    };
  }, [selectedCrop.id, selectedChecklistWeek, plantingType, language, checklistCache]);

  // Handlers for Tanya AI
  const handleMediaUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setUploadedMedia({ data: base64String, mimeType: file.type });
      setAnalysisError('');
    };
    reader.onerror = () => {
        setAnalysisError(t('mediaReadError', language));
    };
    reader.readAsDataURL(file);
  };

  const handleClearChat = useCallback(() => {
      setUploadedMedia(null);
      setAiQuestion('');
      setChatHistory([]);
      setAnalysisError('');
      setIsAnalyzing(false);
      setAiChatSession(null);
  }, []);
  
  const handleClearMedia = () => {
      setUploadedMedia(null);
  };

  const handleSendMessage = async (message: string, media: {data: string; mimeType: string} | null = null) => {
    const isFirstMessage = aiChatSession === null;
    if (!message && !media) return;

    setIsAnalyzing(true);
    setAnalysisError('');
    
    const messageContent = message || (media ? t('defaultAnalysisMessage', language) : '');

    const userMessage: ChatMessage = {
        role: 'user',
        text: messageContent,
        media: isFirstMessage && media ? { data: media.data, mimeType: media.mimeType } : undefined
    };
    setChatHistory(prev => [...prev, userMessage]);
    
    try {
        let chat: Chat;
        if (isFirstMessage) {
            const plantingTypeName = PLANTING_TYPES.find(p => p.id === plantingType)?.name[language] || plantingType;
            const context = language === 'id' ? `Konteks: Petani menanam ${selectedCrop.name.id} dalam lingkungan tanam '${plantingTypeName}'.` : `Context: Farmer is growing ${selectedCrop.name.en} in a '${plantingTypeName}' setup.`;
            chat = createChatSession(language, context);
            setAiChatSession(chat);
        } else {
            chat = aiChatSession!;
        }

        const mediaData = media ? {
            base64Data: media.data.split(',')[1],
            mimeType: media.mimeType,
        } : null;
        
        const result = await sendMessage(chat, messageContent, mediaData, language);
        setChatHistory(prev => [...prev, { role: 'model', text: result }]);

        if (isFirstMessage) {
            setAiQuestion('');
            setUploadedMedia(null);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('analysisFailedError', language);
        setAnalysisError(errorMessage);
        setChatHistory(prev => [...prev, userMessage].slice(0, -1)); // Remove user message on error
    } finally {
        setIsAnalyzing(false);
    }
  };

  // Project Management Handlers
  const handleNewProject = useCallback(() => {
    setCurrentProjectId(null);
    setSelectedCrop(CROPS[0]);
    setPlantingType('field');
    setPlantingDate(new Date().toISOString().split('T')[0]);
    setExpenses([]);
    setExpectedYield(5000);
    setMarketPrice(4500);
    setCompletedTasks({});
    handleClearChat();
    setActiveView('planner');
  }, [handleClearChat]);

  const handleSaveProject = (projectName: string) => {
    const projectId = currentProjectId || new Date().toISOString();
    const projectToSave: Project = {
        id: projectId,
        name: projectName,
        selectedCropId: selectedCrop.id,
        plantingType,
        plantingDate,
        expenses,
        expectedYield,
        marketPrice,
        completedTasks,
    };

    setProjects(prevProjects => {
        const existingIndex = prevProjects.findIndex(p => p.id === projectId);
        if (existingIndex > -1) {
            const updated = [...prevProjects];
            updated[existingIndex] = projectToSave;
            return updated;
        }
        return [...prevProjects, projectToSave];
    });
    setCurrentProjectId(projectId);
  };
  
  const handleUpdateProject = () => {
    if (!currentProjectId) return;

    const currentProject = projects.find(p => p.id === currentProjectId);
    if (!currentProject) return;

    const projectToSave: Project = {
        id: currentProjectId,
        name: currentProject.name,
        selectedCropId: selectedCrop.id,
        plantingType,
        plantingDate,
        expenses,
        expectedYield,
        marketPrice,
        completedTasks,
    };

    setProjects(prevProjects => 
        prevProjects.map(p => p.id === currentProjectId ? projectToSave : p)
    );
    // In a real app, you might show a "Project Saved!" toast notification here.
  };

  const handleLoadProject = (projectId: string) => {
    const projectToLoad = projects.find(p => p.id === projectId);
    if (!projectToLoad) return;

    const crop = CROPS.find(c => c.id === projectToLoad.selectedCropId) || CROPS[0];
    
    setSelectedCrop(crop);
    setPlantingType(projectToLoad.plantingType);
    setPlantingDate(projectToLoad.plantingDate);
    setExpenses(projectToLoad.expenses);
    setExpectedYield(projectToLoad.expectedYield);
    setMarketPrice(projectToLoad.marketPrice);
    setCompletedTasks(projectToLoad.completedTasks);
    setCurrentProjectId(projectToLoad.id);
    handleClearChat();
    setActiveView('planner');
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (currentProjectId === projectId) {
        handleNewProject();
    }
  };

  // UI Components
  const NavButton: React.FC<{
    view: View;
    label: string;
    icon: React.ReactNode;
  }> = ({ view, label, icon }) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => setActiveView(view)}
        className={`flex items-center gap-2 px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
          isActive
            ? 'border-brand-green-600 text-brand-green-700'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };
  
  const LanguageSwitcher: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div className="relative">
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-gray-600 hover:text-brand-green-700 p-2 rounded-md transition-colors">
          <GlobeIcon className="h-5 w-5" />
          <span className="font-medium text-sm">{language.toUpperCase()}</span>
        </button>
        {isOpen && (
           <div className="absolute right-0 mt-2 w-28 bg-white rounded-md shadow-lg py-1 z-20">
            <button onClick={() => { setLanguage('id'); setIsOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Bahasa (ID)</button>
            <button onClick={() => { setLanguage('en'); setIsOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">English (EN)</button>
           </div>
        )}
      </div>
    )
  };

  return (
    <div className="min-h-screen bg-brand-green-50/50 text-gray-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoIcon className="h-10 w-10 text-brand-green-700" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-brand-green-900">Tani Cerdas</h1>
              <p className="text-sm sm:text-base text-brand-green-700">{t('tagline', language)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProjectControls
              language={language}
              currentProjectName={currentProjectName}
              onSave={handleSaveProject}
              onUpdate={handleUpdateProject}
            />
            <LanguageSwitcher />
          </div>
        </header>

        <nav className="mb-8">
          <div className="border-b border-gray-200">
            <div className="-mb-px flex space-x-4" aria-label="Tabs">
              <NavButton view="projects" label={t('projects', language)} icon={<BriefcaseIcon className="h-5 w-5" />} />
              <NavButton view="planner" label={t('planner', language)} icon={<ClipboardListIcon className="h-5 w-5" />} />
              <NavButton view="plant" label={t('plant', language)} icon={<SproutIcon className="h-5 w-5" />} />
              <NavButton view="gulma" label={t('gulma', language)} icon={<WeedIcon className="h-5 w-5" />} />
              <NavButton view="catalog" label={t('catalog', language)} icon={<CatalogIcon className="h-5 w-5" />} />
              <NavButton view="tanyaAi" label={t('tanyaAi', language)} icon={<PlantAnalysisIcon className="h-5 w-5" />} />
            </div>
          </div>
        </nav>

        <main>
          {activeView === 'projects' && (
              <ProjectDashboard 
                  language={language}
                  projects={projects}
                  onNew={handleNewProject}
                  onLoad={handleLoadProject}
                  onDelete={handleDeleteProject}
              />
          )}
          {activeView === 'planner' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 animate-fade-in">
              <div className="lg:col-span-1">
                <PlannerCard
                  language={language}
                  crops={CROPS}
                  selectedCrop={selectedCrop}
                  onCropChange={(cropId) => {
                    const newCrop = CROPS.find(c => c.id === cropId);
                    if (newCrop) setSelectedCrop(newCrop);
                  }}
                  plantingDate={plantingDate}
                  onDateChange={setPlantingDate}
                  plantingTypes={PLANTING_TYPES}
                  selectedPlantingType={plantingType}
                  onPlantingTypeChange={setPlantingType}
                />
              </div>
              <div className="lg:col-span-1">
                <RoiCard
                  language={language}
                  totalExpenses={totalExpenses}
                  expectedYield={expectedYield}
                  onYieldChange={setExpectedYield}
                  marketPrice={marketPrice}
                  onPriceChange={setMarketPrice}
                />
              </div>
              <div className="lg:col-span-2">
                <ExpenseTrackerCard 
                  language={language}
                  expenses={expenses}
                  onAddExpense={handleAddExpense}
                  onRemoveExpense={handleRemoveExpense}
                />
              </div>
              <div className="lg:col-span-4">
                <ChecklistCard
                  language={language}
                  crop={selectedCrop}
                  totalWeeks={selectedCrop.avgGrowthWeeks}
                  currentWeek={currentWeek}
                  selectedWeek={selectedChecklistWeek}
                  onWeekChange={setSelectedChecklistWeek}
                  checklist={checklist}
                  isLoading={isLoadingChecklist}
                  onToggleItem={handleToggleChecklistItem}
                />
              </div>
            </div>
          )}

          {activeView === 'plant' && (
              <div className="max-w-7xl mx-auto">
                  <PlantInfoCard
                      language={language}
                      crops={CROPS}
                      selectedCropId={viewingCropId}
                      onCropChange={setViewingCropId}
                  />
              </div>
          )}

          {activeView === 'gulma' && (
              <div className="max-w-7xl mx-auto">
                  <GulmaCard 
                      language={language} 
                      items={WEEDS}
                  />
              </div>
          )}

          {activeView === 'catalog' && (
              <div className="max-w-7xl mx-auto">
                  <CatalogCard 
                      language={language} 
                      items={CATALOG_ITEMS}
                  />
              </div>
          )}

          {activeView === 'tanyaAi' && (
            <div className="max-w-4xl mx-auto">
              <TanyaAiCard
                  language={language} 
                  question={aiQuestion}
                  onQuestionChange={setAiQuestion}
                  media={uploadedMedia}
                  chatHistory={chatHistory}
                  isAnalyzing={isAnalyzing}
                  error={analysisError}
                  onMediaSelected={handleMediaUpload}
                  onSendMessage={handleSendMessage}
                  onClearChat={handleClearChat}
                  onClearMedia={handleClearMedia}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
