'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { checkAuth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface Role {
  id: number;
  title: string;
  bulletPoints: string[];
}

function SortableRole({ role }: { role: Role }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });

  const router = useRouter();

  useEffect(() => {
      if (!checkAuth()) {
          router.push('/signup');
      }
  }, [router]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-4 rounded-lg cursor-move transition-all bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-transparent ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div {...listeners} className='flex items-center gap-2 mb-2'>
        <svg
          className='w-6 h-6 text-gray-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M4 8h16M4 16h16'
          />
        </svg>
        <h3 className='text-white font-medium'>{role.title}</h3>
      </div>
      <ul className='space-y-1'>
        {role.bulletPoints.map((point, index) => (
          <li key={index} className='text-gray-400 text-sm flex items-start'>
            <span className='mr-2 text-gray-400'>•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TopRoles() {
  const [roles, setRoles] = useState<Role[]>([
    {
      id: 1,
      title: 'Engineering Technician/Lab Assistant',
      bulletPoints: [
        'Testing equipment, data collection, basic troubleshooting',
        'Low barrier to entry, builds fundamental skills',
      ],
    },
    {
      id: 2,
      title: 'Engineering Technician/Lab Assistant',
      bulletPoints: [
        'Testing equipment, data collection, basic troubleshooting',
        'Low barrier to entry, builds fundamental skills',
      ],
    },
    {
      id: 3,
      title: 'Engineering Technician/Lab Assistant',
      bulletPoints: [
        'Testing equipment, data collection, basic troubleshooting',
        'Low barrier to entry, builds fundamental skills',
      ],
    },
    {
      id: 4,
      title: 'Engineering Technician/Lab Assistant',
      bulletPoints: [
        'Testing equipment, data collection, basic troubleshooting',
        'Low barrier to entry, builds fundamental skills',
      ],
    },
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRoles((roles) => {
        const oldIndex = roles.findIndex((role) => role.id === active.id);
        const newIndex = roles.findIndex((role) => role.id === over.id);
        return arrayMove(roles, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = () => {
    console.log('Ordered roles:', roles);
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top Roles
        </h1>
        <p className='text-gray-400 text-sm text-center mb-6'>
          Based on our AI analysis of your goals
        </p>

        <p className='text-gray-300 text-sm mb-4'>
          Order the roles based on how much you like them
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={roles} strategy={verticalListSortingStrategy}>
            <div className='space-y-3 mb-6'>
              {roles.map((role) => (
                <div key={role.id}>
                  <SortableRole role={role} />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className='flex justify-between gap-4'>
          <button
            className='px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors'
            onClick={() => {
              const newId = Math.max(...roles.map((r) => r.id)) + 1;
              setRoles([
                ...roles,
                {
                  id: newId,
                  title: 'Engineering Technician/Lab Assistant',
                  bulletPoints: [
                    'Testing equipment, data collection, basic troubleshooting',
                    'Low barrier to entry, builds fundamental skills',
                  ],
                },
              ]);
            }}
          >
            Add Role
          </button>
          <button
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
