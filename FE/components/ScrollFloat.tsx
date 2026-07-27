"use client";

import React, { useEffect, useMemo, useRef, ReactNode, RefObject } from 'react';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollFloatProps {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
}

const ScrollFloat: React.FC<ScrollFloatProps> = ({
  children,
  scrollContainerRef,
  containerClassName = '',
  textClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'center bottom+=50%',
  scrollEnd = 'bottom bottom-=40%',
  stagger = 0.03
}) => {
  const containerRef = useRef<HTMLHeadingElement>(null);

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    return text.split('').map((char, index) => (
      <span className="inline-block word" key={index}>
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller = scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;

    const charElements = el.querySelectorAll('.inline-block');

    const animation = gsap.fromTo(
      charElements,
      {
        willChange: 'opacity, transform',
        opacity: 0,
        yPercent: 120,
        scaleY: 2.3,
        scaleX: 0.7,
        transformOrigin: '50% 0%'
      },
      {
        duration: animationDuration,
        ease: ease,
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger: stagger,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: scrollStart,
          end: scrollEnd,
          scrub: true
        }
      }
    );

    return () => {
      animation.scrollTrigger?.kill();
      animation.kill();
    };
  }, [scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger]);

  return (
    <h2 ref={containerRef} className={`my-5 overflow-hidden ${containerClassName}`}>
      <span className={`inline-block text-[clamp(1.6rem,4vw,3rem)] leading-[1.5] ${textClassName}`}>{splitText}</span>
    </h2>
  );
};

interface ScrollFloatProviderProps {
  children: ReactNode;
}

const headingSelector = [
  'main h1',
  'main h2',
  '[data-scroll-float="true"]',
].join(',');

function canFloatElement(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.dataset.scrollFloatReady === 'true') return false;
  if (element.dataset.scrollFloat === 'false') return false;
  if (element.closest('header, nav, aside, button, [role="button"], form')) return false;
  if (element.children.length > 0 && element.dataset.scrollFloat !== 'true') return false;

  const text = element.textContent?.trim() || '';
  return text.length > 0 && text.length <= 90;
}

function splitElementText(element: HTMLElement) {
  const originalHtml = element.innerHTML;
  const text = element.textContent || '';

  element.dataset.scrollFloatOriginal = originalHtml;
  element.dataset.scrollFloatReady = 'true';
  element.setAttribute('aria-label', text.trim());
  element.classList.add('overflow-hidden');

  element.innerHTML = text
    .split('')
    .map((char) => {
      const content = char === ' ' ? '&nbsp;' : char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span aria-hidden="true" class="scroll-float-char inline-block">${content}</span>`;
    })
    .join('');
}

export function ScrollFloatProvider({ children }: ScrollFloatProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const animations: gsap.core.Tween[] = [];
    const elements = Array.from(document.querySelectorAll(headingSelector)).filter(canFloatElement) as HTMLElement[];

    elements.forEach((element) => {
      splitElementText(element);
      const chars = element.querySelectorAll('.scroll-float-char');

      const animation = gsap.fromTo(
        chars,
        {
          willChange: 'opacity, transform',
          opacity: 0,
          yPercent: 120,
          scaleY: 1.6,
          scaleX: 0.85,
          transformOrigin: '50% 0%',
        },
        {
          duration: 0.9,
          ease: 'back.out(1.8)',
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger: 0.018,
          scrollTrigger: {
            trigger: element,
            start: 'top bottom-=10%',
            end: 'bottom center',
            scrub: true,
          },
        }
      );

      animations.push(animation);
    });

    ScrollTrigger.refresh();

    return () => {
      animations.forEach((animation) => {
        animation.scrollTrigger?.kill();
        animation.kill();
      });

      elements.forEach((element) => {
        if (element.dataset.scrollFloatOriginal) {
          element.innerHTML = element.dataset.scrollFloatOriginal;
          delete element.dataset.scrollFloatOriginal;
        }
        delete element.dataset.scrollFloatReady;
        element.removeAttribute('aria-label');
      });
    };
  }, [pathname]);

  return <>{children}</>;
}

export default ScrollFloat;
