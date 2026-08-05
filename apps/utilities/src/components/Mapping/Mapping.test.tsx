import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Mapping from './Mapping';

interface Item {
  id: string;
  label: string;
}

const items: Item[] = [
  { id: '1', label: 'One' },
  { id: '2', label: 'Two' },
  { id: '3', label: 'Three' },
];

describe('Mapping', () => {
  it('renders one output per array item, in order', () => {
    render(
      <ul>
        <Mapping array={items}>{(item) => <li>{item.label}</li>}</Mapping>
      </ul>,
    );

    expect(screen.getAllByRole('listitem').map((el) => el.textContent)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
  });

  it('passes both item and index to the render function', () => {
    render(
      <Mapping array={items}>
        {(item, index) => <span key={item.id}>{`${index}:${item.label}`}</span>}
      </Mapping>,
    );

    expect(screen.getByText('0:One')).toBeTruthy();
    expect(screen.getByText('2:Three')).toBeTruthy();
  });

  it('wraps each item in a div with itemClassName when wrapper is true', () => {
    const { container } = render(
      <Mapping array={items} wrapper itemClassName="row">
        {(item) => item.label}
      </Mapping>,
    );

    const rows = container.querySelectorAll('div.row');
    expect(rows).toHaveLength(3);
  });

  it('wraps the whole list in a div with className when globalWrapper is true', () => {
    const { container } = render(
      <Mapping array={items} globalWrapper className="list">
        {(item) => <span key={item.id}>{item.label}</span>}
      </Mapping>,
    );

    expect(container.querySelector('div.list')).not.toBeNull();
  });

  it('renders nothing for a null or undefined array', () => {
    const { container } = render(<Mapping array={null}>{(item: Item) => item.label}</Mapping>);
    expect(container.textContent).toBe('');
  });
});
