'use client';

import React, { useState } from 'react';
import { Drawer } from 'vaul';

// 1. Define the data structure
interface CardData {
  id: number;
  title: string;
  summary: string;
  fullDetails: string; // Extra data we only show in the bottom sheet
}

const mockData: CardData[] = [
  { 
    id: 1, 
    title: 'Learn Next.js', 
    summary: 'Server-side rendering made easy.',
    fullDetails: 'Next.js gives you the best developer experience with all the features you need for production: hybrid static & server rendering, TypeScript support, smart bundling, route pre-fetching, and more.'
  },
  { 
    id: 2, 
    title: 'Master Tailwind', 
    summary: 'Utility-first CSS framework.',
    fullDetails: 'Tailwind CSS works by scanning all of your HTML files, JavaScript components, and any other templates for class names, generating the corresponding styles and then writing them to a static CSS file.'
  },
  { 
    id: 3, 
    title: 'Embrace TypeScript', 
    summary: 'Type safety for your React apps.',
    fullDetails: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale. It catches errors in your editor before you even run your code.'
  },
];

export default function TableCardList() {
    const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h2 className='text-2xl font-bold mb-6 text-gray-800'>Floor Plan</h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                {mockData.map((card) => (
                    <div
                        key={card.id}
                        className="bg-white rounded-xl shadow-md border border-gray-200 p-5 flex flex-col h-full hover:shadow-lg transition-shadow duration-300"
                    >
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{card.title}</h3>
                        <p className="text-gray-600 leading-relaxed mb-4 grow">{card.summary}</p>
                        <button
                            type='button'
                            onClick={() => setSelectedCard(card)}
                            className="mt-auto w-full px-4 py-2.5 bg-blue-100 text-black text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                            Read More
                        </button>
                        </div>
                ))}
            </div>
            <Drawer.Root 
        open={!!selectedCard} 
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedCard(null);
        }}
            >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
          <Drawer.Content className="bg-white flex flex-col rounded-t-3xl h-[60vh] mt-24 fixed bottom-0 left-0 right-0 z-50 focus:outline-none">
<div className="p-6 bg-white rounded-t-3xl flex-1 overflow-y-auto">
              
              {/* Visual drag handle */}
              <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-gray-300 mb-6" />
              
              {/* Render data ONLY if a card is selected */}
              {selectedCard && (
                <div className="max-w-md mx-auto">
                  <Drawer.Title className="font-bold text-3xl text-gray-900 mb-2">
                    {selectedCard.title}
                  </Drawer.Title>
                  
                  <Drawer.Description className="text-lg text-gray-600 mb-8 leading-relaxed">
                    {selectedCard.fullDetails}
                  </Drawer.Description>
                  
                  <button 
                    onClick={() => setSelectedCard(null)}
                    className="w-full py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
              
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
        </div>
    )
}
