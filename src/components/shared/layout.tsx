/**
 * Layout utility components for consistent spacing and alignment
 */
import React from 'react'

interface BaseProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

interface StackProps extends BaseProps {
  gap?: 'xs' | 'sm' | 'md' | 'lg' | number;
  mt?: 'xs' | number;
  p?: 'sm' | number;
}

export function Stack({ gap = 'md', mt, p, className = '', children, ...props }: StackProps) {
  const gapClass = typeof gap === 'number' ? `gap-[${gap}px]` : gap === 'xs' ? 'gap-1' : gap === 'sm' ? 'gap-2' : gap === 'lg' ? 'gap-6' : 'gap-4'
  const marginTopStyle = typeof mt === 'string' && mt === 'xs' ? { marginTop: '8px' } : typeof mt === 'number' ? { marginTop: `${mt}px` } : {}
  const paddingStyle = typeof p === 'string' && p === 'sm' ? { padding: '8px' } : typeof p === 'number' ? { padding: `${p}px` } : {}
  return (
    <div className={`flex flex-col ${gapClass} ${className}`.trim()} style={{ ...marginTopStyle, ...paddingStyle }} {...props}>
      {children}
    </div>
  )
}

interface GroupProps extends BaseProps {
  gap?: 'xs' | 'sm' | 'md' | 'lg' | number;
  justify?: 'space-between' | 'flex-start' | 'flex-end' | 'center' | string;
  align?: 'flex-start' | 'flex-end' | 'stretch' | 'center' | string;
}

export function Group({ gap = 'md', justify, align = 'center', className = '', children, ...props }: GroupProps) {
  const gapClass = typeof gap === 'number' ? `gap-[${gap}px]` : gap === 'xs' ? 'gap-1' : gap === 'sm' ? 'gap-2' : gap === 'lg' ? 'gap-6' : 'gap-4'
  const justifyClass = justify === 'space-between' ? 'justify-between' : justify === 'flex-start' ? 'justify-start' : justify === 'flex-end' ? 'justify-end' : justify === 'center' ? 'justify-center' : ''
  const alignClass = align === 'flex-start' ? 'items-start' : align === 'flex-end' ? 'items-end' : align === 'stretch' ? 'items-stretch' : align === 'center' ? 'items-center' : ''
  return (
    <div className={`flex ${gapClass} ${justifyClass} ${alignClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

interface TextProps extends BaseProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | string;
  fw?: number | string;
  mt?: number;
  mb?: number;
  tt?: 'uppercase' | string;
  truncate?: boolean;
}

/**
 * Text component with size and weight options
 */
export function Text({ size = 'md', fw, mt, mb, tt, truncate, className = '', style, children, ...props }: TextProps) {
  const sizeClass = size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : size === '10px' ? 'text-[10px]' : 'text-base'
  const weightClass = typeof fw === 'number' ? (fw >= 700 ? 'font-bold' : fw >= 600 ? 'font-semibold' : fw >= 500 ? 'font-medium' : '') : ''
  const transformClass = tt === 'uppercase' ? 'uppercase' : ''
  const truncateClass = truncate ? 'truncate' : ''
  const nextStyle = {
    ...(typeof mt === 'number' ? { marginTop: `${mt}px` } : {}),
    ...(typeof mb === 'number' ? { marginBottom: `${mb}px` } : {}),
    ...style}
  return (
    <div className={`${sizeClass} ${weightClass} ${transformClass} ${truncateClass} ${className}`.trim()} style={nextStyle} {...props}>
      {children}
    </div>
  )
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string;
  variant?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Badge component with color variants (adapted from Mantine)
 */
export function Badge({ color, className = '', children, ...props }: BadgeProps) {
  const toneClass = color === 'green'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : color === 'teal'
      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
      : color === 'yellow' || color === 'orange'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : color === 'indigo'
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${toneClass} ${className}`.trim()} {...props}>
      {children}
    </span>
  )
}

interface CardProps extends BaseProps {
  withBorder?: boolean;
  radius?: 'md' | 'lg' | 'xl' | string;
}

/**
 * Card component with border and radius options (adapted from Mantine)
 */
export function Card({ withBorder, radius, className = '', children, ...props }: CardProps) {
  const borderClass = withBorder ? 'border border-gray-200 dark:border-gray-800' : ''
  const radiusClass = radius === 'md' ? 'rounded-md' : radius === 'lg' ? 'rounded-lg' : radius === 'xl' ? 'rounded-xl' : 'rounded'
  return (
    <div className={`${borderClass} ${radiusClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  block?: boolean;
  children?: React.ReactNode;
}

/**
 * Code component with block option
 */
export function Code({ block, style, children, ...props }: CodeProps) {
  return block ? (
    <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono" style={style} {...props}>
      <code>{children}</code>
    </pre>
  ) : (
    <code className="bg-muted rounded px-1 py-0.5 text-xs font-mono" style={style} {...props}>
      {children}
    </code>
  )
}
