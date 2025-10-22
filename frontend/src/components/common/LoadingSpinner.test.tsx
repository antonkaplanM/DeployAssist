import { describe, it, expect } from 'vitest';
import { render, screen } from '../../tests/test-utils';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders loading spinner with default message', () => {
    render(<LoadingSpinner />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders loading spinner with custom message', () => {
    const customMessage = 'Loading data...';
    render(<LoadingSpinner message={customMessage} />);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('renders without message when message prop is null', () => {
    const { container } = render(<LoadingSpinner message={null} />);
    
    // Should still render the spinner div
    const spinnerDiv = container.querySelector('.animate-spin');
    expect(spinnerDiv).toBeInTheDocument();
    
    // Should not render message
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('renders with different size variants', () => {
    const { container, rerender } = render(<LoadingSpinner size="sm" />);
    
    let spinnerDiv = container.querySelector('.animate-spin');
    expect(spinnerDiv).toHaveClass('h-4', 'w-4', 'border-2');
    
    rerender(<LoadingSpinner size="lg" />);
    spinnerDiv = container.querySelector('.animate-spin');
    expect(spinnerDiv).toHaveClass('h-12', 'w-12', 'border-4');
  });
});

