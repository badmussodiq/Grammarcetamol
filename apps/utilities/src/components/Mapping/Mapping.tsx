import { Fragment } from 'react';
import type { ReactNode } from 'react';

export interface MappingProps<T> {
  array: readonly T[] | null | undefined;
  children: (item: T, index: number) => ReactNode;
  /** Stable key per item. Falls back to index when omitted — pass this whenever the array can reorder, filter, or splice. */
  keyExtractor?: (item: T, index: number) => string | number;
  className?: string;
  itemClassName?: string;
  /** Wrap each rendered item in its own <div itemClassName>. */
  wrapper?: boolean;
  /** Wrap the whole list in a <div className>. */
  globalWrapper?: boolean;
}

/**
 * No 'use client' here on purpose, and no useMemo — this has to stay a plain
 * component with zero client-only hooks so it can render inside Server
 * Components too. A render-prop `children` function can't cross a Server ->
 * Client boundary (React can't serialize functions across it), so the moment
 * this needs 'use client' it stops working from pages like the admin /users
 * Server Component. Memoizing the mapped output bought little anyway, since
 * `children` is almost always a fresh inline arrow function per render.
 */
function Mapping<T>({
  array,
  children,
  keyExtractor,
  className,
  itemClassName,
  wrapper = false,
  globalWrapper = false,
}: MappingProps<T>) {
  const items = array?.map((item, index) => {
    const key = keyExtractor ? keyExtractor(item, index) : index;
    return wrapper ? (
      <div className={itemClassName} key={key}>
        {children(item, index)}
      </div>
    ) : (
      <Fragment key={key}>{children(item, index)}</Fragment>
    );
  });

  return globalWrapper ? <div className={className}>{items}</div> : <>{items}</>;
}

export default Mapping;
