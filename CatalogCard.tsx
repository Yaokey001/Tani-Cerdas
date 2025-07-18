import React, { useState, useMemo, useEffect } from 'react';
import type { Language, CatalogItem, CatalogItemType, ChemicalSubtype, FertilizerSubtype } from '../types';
import { t } from '../i18n';
import { FertilizerIcon, ChemicalIcon } from './IconComponents';

interface CatalogCardProps {
    language: Language;
    items: CatalogItem[];
}

type SoilReaction = 'acid' | 'alkaline' | 'neutral';

const DetailSection: React.FC<{title: string, content?: string}> = ({title, content}) => {
    if (!content) return null;
    return (
        <div>
            <h4 className="font-semibold text-gray-800 mb-1">{title}</h4>
            <p className="text-sm text-gray-600 whitespace-pre-line">{content}</p>
        </div>
    );
};

const CatalogCard: React.FC<CatalogCardProps> = ({ language, items }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<CatalogItemType | 'all'>('all');
    const [activeSubtype, setActiveSubtype] = useState<ChemicalSubtype | FertilizerSubtype | 'all'>('all');
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

    useEffect(() => {
        setActiveSubtype('all');
    }, [activeFilter]);

    const filteredItems = useMemo(() => {
        return items
            .filter(item => {
                if (activeFilter === 'all') return true;
                return item.type === activeFilter;
            })
            .filter(item => {
                if (activeSubtype !== 'all') {
                    return item.subtype === activeSubtype;
                }
                return true;
            })
            .filter(item => item.name[language].toLowerCase().includes(searchTerm.toLowerCase()));
    }, [items, activeFilter, activeSubtype, searchTerm, language]);
    
    const getReactionColor = (reaction: SoilReaction) => {
        switch (reaction) {
            case 'acid': return 'bg-orange-100 text-orange-800';
            case 'alkaline': return 'bg-blue-100 text-blue-800';
            case 'neutral': return 'bg-gray-200 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    const FilterButton: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => {
        return (
            <button
                onClick={onClick}
                className={`px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium rounded-md transition-colors ${
                    active ? 'bg-brand-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
                {label}
            </button>
        );
    };
    
    const chemicalSubtypes: ChemicalSubtype[] = ['insecticide', 'herbicide', 'fungicide'];
    const fertilizerSubtypes: FertilizerSubtype[] = ['single', 'compound', 'organic', 'soil_amendment'];

    return (
        <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col min-h-[75vh]">
            <h2 className="text-xl font-bold text-brand-green-900 mb-4">{t('catalogTitle', language)}</h2>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="md:col-span-1 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <FilterButton label={t('all', language)} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
                        <FilterButton label={t('fertilizers', language)} active={activeFilter === 'fertilizer'} onClick={() => setActiveFilter('fertilizer')} />
                        <FilterButton label={t('chemicals', language)} active={activeFilter === 'chemical'} onClick={() => setActiveFilter('chemical')} />
                    </div>

                    {activeFilter === 'fertilizer' && (
                        <div className="p-2 bg-gray-100 rounded-md animate-fade-in">
                            <div className="flex flex-wrap items-center gap-2">
                                <FilterButton label={t('all', language)} active={activeSubtype === 'all'} onClick={() => setActiveSubtype('all')} />
                                {fertilizerSubtypes.map(subtype => (
                                     <FilterButton key={subtype} label={t(subtype, language)} active={activeSubtype === subtype} onClick={() => setActiveSubtype(subtype)} />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {activeFilter === 'chemical' && (
                        <div className="p-2 bg-gray-100 rounded-md animate-fade-in">
                            <div className="flex flex-wrap items-center gap-2">
                                <FilterButton label={t('all', language)} active={activeSubtype === 'all'} onClick={() => setActiveSubtype('all')} />
                                {chemicalSubtypes.map(subtype => (
                                     <FilterButton key={subtype} label={t(subtype, language)} active={activeSubtype === subtype} onClick={() => setActiveSubtype(subtype)} />
                                ))}
                            </div>
                        </div>
                    )}

                    <input
                        type="text"
                        placeholder={t('searchPlaceholder', language)}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-green-500 focus:border-brand-green-500"
                    />
                    <div className="flex-grow border rounded-lg overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-brand-green-300 hover:[&::-webkit-scrollbar-thumb]:bg-brand-green-400 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin] [scrollbar-color:#86efac_#f3f4f6]">
                        {filteredItems.length > 0 ? (
                            <ul>
                                {filteredItems.map(item => (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => setSelectedItem(item)}
                                            className={`w-full text-left p-3 flex items-center gap-3 transition-colors border-l-4 ${
                                                selectedItem?.id === item.id ? 'bg-brand-green-50 border-brand-green-600' : 'hover:bg-gray-50 border-transparent'
                                            }`}
                                        >
                                            {item.type === 'fertilizer' ? <FertilizerIcon className="h-5 w-5 text-green-600 shrink-0"/> : <ChemicalIcon className="h-5 w-5 text-orange-600 shrink-0"/>}
                                            <span className="font-medium text-sm text-gray-800">{item.name[language]}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 p-4">
                                {t('noItemsFound', language)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="md:col-span-2 bg-gray-50 rounded-lg p-6 min-h-[40vh] md:min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-brand-green-300 hover:[&::-webkit-scrollbar-thumb]:bg-brand-green-400 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin] [scrollbar-color:#86efac_#f3f4f6]">
                    {selectedItem ? (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{selectedItem.name[language]}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                        selectedItem.type === 'fertilizer' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                                    }`}>
                                        {t(selectedItem.type === 'fertilizer' ? 'fertilizers' : 'chemicals', language)}
                                    </span>
                                    {selectedItem.subtype && (
                                         <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                             {t(selectedItem.subtype, language)}
                                         </span>
                                    )}
                                    {selectedItem.soilReaction && (
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getReactionColor(selectedItem.soilReaction)}`}>
                                            {t(selectedItem.soilReaction, language)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <DetailSection title={t('description', language)} content={selectedItem.description[language]} />
                            <DetailSection title={t('composition', language)} content={selectedItem.composition?.[language]} />
                            
                            {selectedItem.type === 'fertilizer' && (
                                <>
                                    <DetailSection title={t('physicalProperties', language)} content={selectedItem.physicalProperties?.[language]} />
                                    <DetailSection title={t('chemicalProperties', language)} content={selectedItem.chemicalProperties?.[language]} />
                                    <DetailSection title={t('physiologicalProperties', language)} content={selectedItem.physiologicalProperties?.[language]} />
                                </>
                            )}

                            <DetailSection title={t('usage', language)} content={selectedItem.usage[language]} />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-gray-500">
                           <p>{t('selectItemToView', language)}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CatalogCard;
