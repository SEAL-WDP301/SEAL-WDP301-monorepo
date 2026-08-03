"use client";

import React, { ReactNode } from 'react';

interface ScrollFloatProps {
  children: ReactNode;
  containerClassName?: string;
  textClassName?: string;
  [key: string]: any;
}

const ScrollFloat: React.FC<ScrollFloatProps> = ({
  children,
  containerClassName = '',
  textClassName = '',
}) => {
  return (
    <h2 className={containerClassName}>
      <span className={textClassName}>{children}</span>
    </h2>
  );
};

export function ScrollFloatProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default ScrollFloat;
