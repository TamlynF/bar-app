'use client';

import React from 'react';
import { Drawer } from 'vaul';

interface SwipeableSheetProps {
  triggerText: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function TableBottomSheet({ 
  triggerText, 
  title, 
  description, 
  children 
}: SwipeableSheetProps) {
  return (
      <Drawer.Root>
        <Drawer.Trigger asChild>
          <button
            type='button'
            className="mt-auto w-full px-4 py-2.5 bg-blue-100 text-black text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            {triggerText}
          </button>
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/50" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl p-6">
            <Drawer.Title className="text-xl font-semibold">{title}</Drawer.Title>
            {description && <Drawer.Description className="mt-2 text-gray-600">{description}</Drawer.Description>}
            {children}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
  )
}
