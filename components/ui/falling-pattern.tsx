'use client';

import type React from 'react';
import { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

type FallingPatternProps = React.ComponentProps<'div'> & {
	color?: string;
	backgroundColor?: string;
	duration?: number;
	blurIntensity?: string;
	density?: number;
	useVideoFallback?: boolean;
	videoSrc?: string;
	pauseAnimation?: boolean;
};

export function FallingPattern({
	color = 'var(--primary)',
	backgroundColor = 'var(--background)',
	duration = 120,
	density = 1,
	useVideoFallback = false,
	videoSrc,
	pauseAnimation = false,
	className,
}: FallingPatternProps) {
	const [isMobile, setIsMobile] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [reducedMotion, setReducedMotion] = useState(false);

	useEffect(() => {
		setMounted(true);
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		setReducedMotion(mq.matches);
		const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
		mq.addEventListener('change', handleChange);

		const checkMobile = () => {
			setIsMobile(
				/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768
			);
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => {
			mq.removeEventListener('change', handleChange);
			window.removeEventListener('resize', checkMobile);
		};
	}, []);

	// Server render: plain div to avoid hydration mismatch
	if (!mounted) {
		return <div className={cn('relative h-full w-full', className)} style={{ backgroundColor }} />;
	}

	// Mobile: prefer video fallback if provided; otherwise keep the same animation but slightly lighter.
	if (isMobile && useVideoFallback && videoSrc) {
		return (
			<div className={cn('relative h-full w-full overflow-hidden', className)} style={{ backgroundColor }}>
				<video
					className="absolute inset-0 h-full w-full object-cover opacity-70"
					src={videoSrc}
					autoPlay
					muted
					loop
					playsInline
					preload="auto"
				/>
				{/* subtle overlay to keep contrast */}
				<div className="absolute inset-0 bg-black/40" />
			</div>
		);
	}

	// 9-layer pattern (3 columns × 3 gradient groups per tile)
	// Tile is 300×300px, repeated to fill, translated down by CSS animation
	const makePattern = (c: string) => [
		// Column A (x = 0)
		`radial-gradient(3px 80px at 0px 120px, ${c} 0%, ${c} 45%, transparent 100%)`,
		`radial-gradient(3px 80px at 0px 240px, ${c} 0%, ${c} 45%, transparent 100%)`,
		`radial-gradient(1.5px 1.5px at 0px 60px, ${c} 100%, transparent 150%)`,
		// Column B (x = 100)
		`radial-gradient(3px 80px at 100px 150px, ${c} 0%, ${c} 45%, transparent 100%)`,
		`radial-gradient(3px 80px at 100px 270px, ${c} 0%, ${c} 45%, transparent 100%)`,
		`radial-gradient(1.5px 1.5px at 100px 75px, ${c} 100%, transparent 150%)`,
		// Column C (x = 200)
		`radial-gradient(3px 80px at 200px 100px, ${c} 0%, ${c} 45%, transparent 100%)`,
		`radial-gradient(3px 80px at 200px 220px, ${c} 0%, ${c} 45%, transparent 100%)`,
		`radial-gradient(1.5px 1.5px at 200px 50px, ${c} 100%, transparent 150%)`,
	].join(', ');

	// Each of the 9 gradients tiles at 300×300
	const bgSize = Array(9).fill('300px 300px').join(', ');

	const effectiveDuration = isMobile ? Math.max(180, duration) : duration;
	const effectiveDensity = isMobile ? Math.max(1, density * 1.2) : density;
	const animName = `fp-fall-${effectiveDuration}`;

	return (
		<div className={cn('relative h-full w-full overflow-hidden', className)}>
			{/* Keyframe injected as a style tag — avoids globals.css coupling */}
			<style>{`
				@keyframes ${animName} {
					from { transform: translateY(0); }
					to   { transform: translateY(300px); }
				}
			`}</style>

			{/* Tall tile that falls via transform — compositor-only, no repaint */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundColor,
					// Extend 300px above so the seam is invisible
					top: '-300px',
					bottom: 0,
					backgroundImage: makePattern(color),
					backgroundSize: bgSize,
					backgroundRepeat: 'repeat',
					backgroundPosition: 'left top',
					filter: 'brightness(1.15) contrast(1.1)',
					animation: reducedMotion || pauseAnimation
						? 'none'
						: `${animName} ${effectiveDuration}s linear infinite`,
					willChange: 'transform',
				}}
			/>

			{/* Dotted overlay — static, no blur, keeps the grid texture */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, ${backgroundColor} 2px)`,
					backgroundSize: `${8 * effectiveDensity}px ${8 * effectiveDensity}px`,
					zIndex: 1,
				}}
			/>
		</div>
	);
}
