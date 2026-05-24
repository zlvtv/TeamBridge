import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TaskCard from '../TaskCard';

describe('TaskCard', () => {
  let container: HTMLDivElement;

  const mockTask = {
    id: '1',
    title: 'Test Task',
    due_date: '2026-03-24T10:00:00.000Z',
    priority: 'medium' as const,
    status: 'todo' as const,
    tags: ['frontend'],
    report_text: 'Есть короткий отчет',
  };

  const mockAssignees = [
    { id: '2', full_name: 'John Doe', username: 'johndoe', avatar_url: null },
  ];

  const mount = async (props = {}) => {
    const onStatusChange = jest.fn();
    const onEdit = jest.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TaskCard
          task={mockTask}
          projectName="Alpha"
          organizationName="TeamBridge"
          assignees={mockAssignees}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
          {...props}
        />
      );
    });

    return { root, onStatusChange, onEdit };
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders task title, context and tags', async () => {
    const { root } = await mount();

    expect(container.textContent).toContain('Test Task');
    expect(container.textContent).toContain('Проект: Alpha');
    expect(container.textContent).toContain('Организация: TeamBridge');
    expect(container.textContent).toContain('frontend');
    expect(container.textContent).toContain('Есть отчет');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onEdit when the card is clicked', async () => {
    const { root, onEdit } = await mount();

    const card = container.querySelector('div');
    expect(card).not.toBeNull();
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onEdit).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onStatusChange when status select changes', async () => {
    const { root, onStatusChange } = await mount();

    const select = container.querySelector('select') as HTMLSelectElement | null;
    expect(select).not.toBeNull();

    if (select) {
      select.value = 'in_progress';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    expect(onStatusChange).toHaveBeenCalledWith('in_progress');

    await act(async () => {
      root.unmount();
    });
  });

  it('hides actions when requested', async () => {
    const { root } = await mount({ hideActions: true });

    expect(container.querySelector('select')).toBeNull();
    expect(container.textContent).not.toContain('Редактировать');

    await act(async () => {
      root.unmount();
    });
  });
});
