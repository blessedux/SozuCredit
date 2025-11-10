'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface AnimatedARSBalanceProps {
  initialBalance: number; // Initial balance in USD
  usdToArsRate: number; // Current USD to ARS exchange rate
  apy: number; // APY percentage (e.g., 15.5 for 15.5%)
  isVisible: boolean;
  className?: string;
}

export function AnimatedARSBalance({
  initialBalance,
  usdToArsRate,
  apy,
  isVisible,
  className = ""
}: AnimatedARSBalanceProps) {
  const [currentBalance, setCurrentBalance] = useState(initialBalance);
  const [displayBalance, setDisplayBalance] = useState(initialBalance);
  const animationRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef(Date.now());

  // Spring animation for smooth number transitions
  const springValue = useSpring(initialBalance, {
    stiffness: 100,
    damping: 30,
    mass: 0.5,
  });

  // Calculate balance growth based on APY
  const calculateBalanceGrowth = (elapsedSeconds: number) => {
    // Convert APY to continuous growth rate
    const annualRate = apy / 100;
    const continuousRate = Math.log(1 + annualRate);
    const growthFactor = Math.exp(continuousRate * (elapsedSeconds / (365 * 24 * 60 * 60)));
    return initialBalance * growthFactor;
  };

  // Update balance every second
  useEffect(() => {
    if (!isVisible) return;

    const updateBalance = () => {
      const now = Date.now();
      const elapsedMs = now - lastUpdateRef.current;
      const elapsedSeconds = elapsedMs / 1000;

      const newBalance = calculateBalanceGrowth(elapsedSeconds);
      setCurrentBalance(newBalance);

      // Update display balance with spring animation
      springValue.set(newBalance);
    };

    // Start animation
    animationRef.current = setInterval(updateBalance, 1000);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isVisible, initialBalance, apy, springValue]);

  // Update display when spring value changes
  useEffect(() => {
    const unsubscribe = springValue.on('change', (value) => {
      setDisplayBalance(value);
    });

    return unsubscribe;
  }, [springValue]);

  // Reset when initial balance changes
  useEffect(() => {
    setCurrentBalance(initialBalance);
    setDisplayBalance(initialBalance);
    springValue.set(initialBalance);
    lastUpdateRef.current = Date.now();
  }, [initialBalance, springValue]);

  // Convert to ARS
  const arsBalance = displayBalance * usdToArsRate;

  // Format number with commas and more decimals
  // Show no decimals if amount is 0, otherwise show 4 decimal places
  const formatARS = (amount: number) => {
    if (amount === 0) {
      return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  // Split formatted number into integer and decimal parts
  const formatARSWithSmallDecimals = (amount: number) => {
    const formatted = formatARS(amount);
    if (amount === 0) {
      return { integerPart: formatted, decimalPart: "" };
    }
    const [integerPart, decimalPart] = formatted.split(',');

    return { integerPart, decimalPart };
  };

  if (!isVisible) {
    const { integerPart, decimalPart } = formatARSWithSmallDecimals(initialBalance * usdToArsRate);
    return (
      <div className={`flex items-center justify-center min-h-[4rem] ${className}`}>
        <div className="flex items-end">
          <span className="text-6xl font-bold text-white tabular-nums leading-none">
            {integerPart}
          </span>
          {decimalPart && (
            <span className="text-2xl font-bold text-white tabular-nums leading-none align-bottom">
              ,{decimalPart}
            </span>
          )}
        </div>
      </div>
    );
  }

  const { integerPart, decimalPart } = formatARSWithSmallDecimals(arsBalance);

  return (
    <div className={`relative ${className}`}>
      {/* Main balance display */}
      <motion.div
        className="text-6xl font-bold text-white tabular-nums flex items-center justify-center min-h-[4rem]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-end">
          <span className="leading-none">{integerPart}</span>
          {decimalPart && (
            <span className="text-2xl font-bold text-white tabular-nums leading-none align-bottom">
              ,{decimalPart}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Hook to get APY data
export function useAnimatedARSBalance(
  initialBalance: number,
  usdToArsRate: number,
  strategyAddress: string
) {
  const [apy, setApy] = useState<number>(15.5); // Default fallback
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAPY = async () => {
      try {
        const response = await fetch('/api/wallet/defindex/apy');
        const data = await response.json();

        if (data.success && data.apy) {
          setApy(parseFloat(data.apy.primary));
        }
      } catch (error) {
        console.error('Failed to fetch APY for animation:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAPY();

    // Update APY every 30 seconds
    const interval = setInterval(fetchAPY, 30000);
    return () => clearInterval(interval);
  }, [strategyAddress]);

  return {
    apy,
    loading,
    animatedComponent: (
      <AnimatedARSBalance
        initialBalance={initialBalance}
        usdToArsRate={usdToArsRate}
        apy={apy}
        isVisible={true}
      />
    )
  };
}
