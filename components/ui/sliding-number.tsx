'use client';

import { useEffect, useId } from 'react';

import {
  MotionValue,
  motion,
  useSpring,
  useTransform,
  motionValue,
} from 'framer-motion';

import useMeasure from 'react-use-measure';

const TRANSITION = {
  type: 'spring' as const,
  stiffness: 140, // Reduced from 280 to half speed
  damping: 18,
  mass: 0.3,
};

const DECIMAL_TRANSITION = {
  type: 'spring' as const,
  stiffness: 70, // Half of 140 for decimal digits - slower animation
  damping: 18,
  mass: 0.3,
};

function Digit({ value, place, isDecimal = false }: { value: number; place: number; isDecimal?: boolean }) {
  const valueRoundedToPlace = Math.floor(value / place) % 10;
  const initial = motionValue(valueRoundedToPlace);
  const transition = isDecimal ? DECIMAL_TRANSITION : TRANSITION;
  const animatedValue = useSpring(initial, transition);

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <div className={`relative inline-block w-[1ch] overflow-hidden leading-none tabular-nums ${isDecimal ? 'text-[0.5em]' : ''}`}>
      <div className='invisible'>0</div>
      <div className={`absolute inset-0 overflow-hidden ${isDecimal ? 'flex items-end' : ''}`}>
        {Array.from({ length: 10 }, (_, i) => (
          <Number key={i} mv={animatedValue} number={i} isDecimal={isDecimal} />
        ))}
      </div>
    </div>
  );
}

function Number({ mv, number, isDecimal = false }: { mv: MotionValue<number>; number: number; isDecimal?: boolean }) {
  const uniqueId = useId();
  const [ref, bounds] = useMeasure();

  const y = useTransform(mv, (latest) => {
    if (!bounds.height) return 0;

    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * bounds.height;

    if (offset > 5) {
      memo -= 10 * bounds.height;
    }

    // For decimal digits that are bottom-aligned, ensure we don't show numbers above
    // Adjust the position to account for bottom alignment
    if (isDecimal) {
      // No adjustment needed - the items-end alignment handles it
      // But ensure we clip properly by keeping the same calculation
    }

    return memo;
  });

  // don't render the animated number until we know the height
  if (!bounds.height) {
    return (
      <span ref={ref} className='invisible absolute'>
        {number}
      </span>
    );
  }

  const transition = isDecimal ? DECIMAL_TRANSITION : TRANSITION;

  return (
    <motion.span
      style={{ y }}
      layoutId={`${uniqueId}-${number}`}
      className={`absolute inset-0 flex ${isDecimal ? 'items-end justify-center' : 'items-center justify-center'} ${isDecimal ? 'text-[0.5em]' : ''}`}
      transition={transition}
      ref={ref}
    >
      {number}
    </motion.span>
  );
}

type SlidingNumberProps = {
  value: number;
  padStart?: boolean;
  decimalSeparator?: string;
};

export function SlidingNumber({
  value,
  padStart = false,
  decimalSeparator = '.',
}: SlidingNumberProps) {
  const absValue = Math.abs(value);
  const [integerPart, decimalPart] = absValue.toString().split('.');

  // Ensure 4 decimal places
  const formattedValue = absValue.toFixed(4);
  const [formattedInteger, formattedDecimal] = formattedValue.split('.');

  const integerValue = parseInt(formattedInteger, 10);
  const paddedInteger =
    padStart && integerValue < 10 ? `0${formattedInteger}` : formattedInteger;
  const integerDigits = paddedInteger.split('');

  const integerPlaces = integerDigits.map((_, i) =>
    Math.pow(10, integerDigits.length - i - 1)
  );

  return (
    <div className='flex items-end'>
      {value < 0 && '-'}
      {integerDigits.map((_, index) => (
        <Digit
          key={`pos-${integerPlaces[index]}`}
          value={integerValue}
          place={integerPlaces[index]}
        />
      ))}
      {formattedDecimal && (
        <>
          <span className='text-[0.5em] align-bottom leading-none' style={{ lineHeight: '1' }}>{decimalSeparator}</span>
          {formattedDecimal.split('').map((_, index) => (
            <Digit
              key={`decimal-${index}`}
              value={parseInt(formattedDecimal, 10)}
              place={Math.pow(10, formattedDecimal.length - index - 1)}
              isDecimal={true}
            />
          ))}
        </>
      )}
    </div>
  );
}

