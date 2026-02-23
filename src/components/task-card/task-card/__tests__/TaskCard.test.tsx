import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TaskCard from '../TaskCard';

describe('TaskCard', () => {
  const mockTask = {
    id: '1',
    title: 'Test Task',
    description: '<p>This is a test task</p>',
    status: 'todo',
    due_date: '2023-12-31T10:00:00Z',
  };

  const mockAssignees = [
    { id: '2', full_name: 'John Doe', username: 'johndoe', avatar_url: null },
  ];

  const mockOnStatusChange = jest.fn();
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    mockOnStatusChange.mockClear();
    mockOnEdit.mockClear();
  });

  it('renders task title and status', () => {
    render(
      <TaskCard
        task={mockTask}
        assignees={mockAssignees}
        onStatusChange={mockOnStatusChange}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('Не начата')).toBeInTheDocument();
  });

  it('calls onEdit when title is clicked', () => {
    render(
      <TaskCard
        task={mockTask}
        assignees={mockAssignees}
        onStatusChange={mockOnStatusChange}
        onEdit={mockOnEdit}
      />
    );

    fireEvent.click(screen.getByText('Test Task'));
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onStatusChange when status badge is clicked', () => {
    render(
      <TaskCard
        task={mockTask}
        assignees={mockAssignees}
        onStatusChange={mockOnStatusChange}
        onEdit={mockOnEdit}
      />
    );

    fireEvent.click(screen.getByText('Не начата'));
    expect(mockOnStatusChange).toHaveBeenCalledWith('in_progress');
  });

  it('displays due date correctly', () => {
    render(
      <TaskCard
        task={mockTask}
        assignees={mockAssignees}
        onStatusChange={mockOnStatusChange}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText(/31 дек/)).toBeInTheDocument();
  });

  it('displays assignee avatar or initials', () => {
    render(
      <TaskCard
        task={mockTask}
        assignees={mockAssignees}
        onStatusChange={mockOnStatusChange}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('J')).toBeInTheDocument();
  });
});