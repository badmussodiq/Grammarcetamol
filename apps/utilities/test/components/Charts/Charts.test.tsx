import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {BarChart} from '../../../src/components/Charts/BarChart';
import {LineChart} from '../../../src/components/Charts/LineChart';
import {DonutChart} from '../../../src/components/Charts/DonutChart';

describe('BarChart', () => {
  it('renders one bar per datum', () => {
    const { container } = render(
      <BarChart data={[{ label: 'Jan', value: 10 }, { label: 'Feb', value: 20 }]} />,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(2);
    expect(screen.getByText('Jan')).toBeTruthy();
    expect(screen.getByText('Feb')).toBeTruthy();
  });

  it('renders zero-height bars without crashing for an all-zero dataset', () => {
    const { container } = render(<BarChart data={[{ label: 'Empty', value: 0 }]} />);
    expect(container.querySelectorAll('rect')).toHaveLength(1);
  });
});

describe('LineChart', () => {
  it('renders one polyline per series', () => {
    const { container } = render(
      <LineChart
        categories={['Mon', 'Tue', 'Wed']}
        series={[
          { label: 'Gross', color: '#0EA5E9', data: [10, 20, 15] },
          { label: 'Net', color: '#10B981', data: [8, 15, 12] },
        ]}
      />,
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(screen.getByText('Gross')).toBeTruthy();
  });

  it('omits the legend for a single series', () => {
    render(<LineChart categories={['Mon']} series={[{ label: 'Solo', color: '#000', data: [5] }]} />);
    expect(screen.queryByText('Solo')).toBeNull();
  });
});

describe('DonutChart', () => {
  it('renders one circle segment per datum with the correct percentage label', () => {
    render(
      <DonutChart
        data={[
          { label: 'Beginner', value: 75, color: '#0EA5E9' },
          { label: 'Advanced', value: 25, color: '#F59E0B' },
        ]}
      />,
    );
    expect(screen.getByText('Beginner — 75%')).toBeTruthy();
    expect(screen.getByText('Advanced — 25%')).toBeTruthy();
  });
});
