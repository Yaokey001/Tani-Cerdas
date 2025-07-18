import React, { useState } from 'react';
import type { ChecklistItem, Crop, Language } from '../types';
import { t } from '../i18n';
import { ChevronDownIcon } from './IconComponents';

interface ChecklistCardProps {
  language: Language;
  crop: Crop;
  totalWeeks: number;
  currentWeek: number;
  selectedWeek: number;
  onWeekChange: (week: number) => void;
  checklist: ChecklistItem[];
  isLoading: boolean;
  onToggleItem: (id: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green-700"></div>
    </div>
);

const ChecklistListItem: React.FC<{ item: ChecklistItem; onToggle: (id:string) => void; }> = ({ item, onToggle }) => {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-b-0">
        <input
            id={`task-${item.id}`}
            type="checkbox"
            checked={item.completed}
            onChange={() => onToggle(item.id)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-green-600 focus:ring-brand-green-500 cursor-pointer"
        />
        <label htmlFor={`task-${item.id}`} className={`text-sm text-gray-700 ${item.completed ? 'line-through text-gray-400' : ''} cursor-pointer`}>
            {item.task}
        </label>
    </li>
  );
};

const ChecklistCard: React.FC<ChecklistCardProps> = ({ language, crop, totalWeeks, currentWeek, selectedWeek, onWeekChange, checklist, isLoading, onToggleItem }) => {
  const [isOpen, setIsOpen] = useState(true);
    
  const completedTasks = checklist.filter(item => item.completed).length;
  const totalTasks = checklist.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const weekTabs = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between w-full p-6 text-left"
            aria-expanded={isOpen}
        >
            <div className="flex items-center gap-3">
                <div>
                    <h2 className="text-xl font-bold text-brand-green-900">{t('checklistTitle', language)}</h2>
                    <p className="text-sm text-gray-500">{crop.name[language]} - {t('week', language)} {selectedWeek}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-brand-green-800 bg-brand-green-100 px-3 py-1 rounded-full">
                    {crop.icon}
                    <span>{crop.name[language].split(' ')[0]}</span>
                </div>
                <ChevronDownIcon className={`h-6 w-6 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
        </button>

        {isOpen && (
            <div className="px-6 pb-6 pt-0">
                <div className="animate-fade-in">
                    <div className="mb-4">
                        <label htmlFor="week-select" className="block text-sm font-medium text-gray-700 mb-1">{t('selectWeek', language)}</label>
                        <div className="relative">
                            <select
                                id="week-select"
                                value={selectedWeek}
                                onChange={(e) => onWeekChange(Number(e.target.value))}
                                className="w-full appearance-none block pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-green-500 focus:border-brand-green-500 sm:text-sm"
                            >
                                {weekTabs.map((week) => (
                                    <option key={week} value={week}>
                                        {t('week', language)} {week} {week === currentWeek ? `(${t('currentWeek', language)})` : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <ChevronDownIcon className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    <div className="mb-2">
                        <div className="flex justify-between mb-1 text-xs font-medium text-gray-600">
                            <span>{t('progressForWeek', language)} {selectedWeek}</span>
                            <span>{completedTasks} / {totalTasks} {t('tasks', language)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-brand-green-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    <div className="mt-4 -mx-3 px-3 min-h-[16rem] max-h-[24rem] overflow-y-auto">
                        {isLoading ? (
                            <LoadingSpinner />
                        ) : (
                            <ul>
                                {checklist.map((item) => (
                                <ChecklistListItem key={item.id} item={item} onToggle={onToggleItem} />
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ChecklistCard;
