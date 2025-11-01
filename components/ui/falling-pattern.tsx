'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

type FallingPatternProps = React.ComponentProps<'div'> & {
	/** Primary color of the falling elements (default: 'var(--primary)') */
	color?: string;
	/** Background color (default: 'var(--background)') */
	backgroundColor?: string;
	/** Animation duration in seconds (default: 150) */
	duration?: number;
	/** Blur intensity for the overlay effect (default: '1em') */
	blurIntensity?: string;
	/** Pattern density - affects spacing (default: 1) */
	density?: number;
	/** Use video fallback on mobile (default: false) */
	useVideoFallback?: boolean;
	/** Video source for mobile fallback */
	videoSrc?: string;
};

export function FallingPattern({
	color = 'var(--primary)',
	backgroundColor = 'var(--background)',
	duration = 150,
	blurIntensity = '1em',
	density = 1,
	className,
	useVideoFallback = false,
	videoSrc,
}: FallingPatternProps) {
	const [isMobile, setIsMobile] = useState(false);
	const [shouldUseVideo, setShouldUseVideo] = useState(false);
	const prefersReducedMotion = useReducedMotion();

	// Detect mobile device and performance capabilities
	useEffect(() => {
		const checkDevice = () => {
			if (typeof window === 'undefined') return;
			
			const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
				(window.innerWidth < 768); // Mobile breakpoint
			
			setIsMobile(isMobileDevice);
			
			// Use video fallback on mobile if enabled and video src provided
			if (isMobileDevice && useVideoFallback && videoSrc) {
				setShouldUseVideo(true);
			}
		};

		checkDevice();
		window.addEventListener('resize', checkDevice);
		return () => window.removeEventListener('resize', checkDevice);
	}, [useVideoFallback, videoSrc]);

	// Mobile-optimized: More columns for better coverage
	const generateMobileBackgroundImage = () => {
		const patterns = [
			// Column 1
			`radial-gradient(3px 60px at 0px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 0px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 0px 75px, ${color} 100%, transparent 150%)`,
			// Column 2
			`radial-gradient(3px 60px at 50px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 50px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 50px 75px, ${color} 100%, transparent 150%)`,
			// Column 3
			`radial-gradient(3px 60px at 100px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 100px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 100px 75px, ${color} 100%, transparent 150%)`,
			// Column 4
			`radial-gradient(3px 60px at 150px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 150px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 150px 75px, ${color} 100%, transparent 150%)`,
			// Column 5
			`radial-gradient(3px 60px at 200px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 200px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 200px 75px, ${color} 100%, transparent 150%)`,
			// Column 6
			`radial-gradient(3px 60px at 250px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 250px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 250px 75px, ${color} 100%, transparent 150%)`,
			// Column 7
			`radial-gradient(3px 60px at 300px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 300px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 300px 75px, ${color} 100%, transparent 150%)`,
			// Column 8
			`radial-gradient(3px 60px at 350px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(3px 60px at 350px 250px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1px 1px at 350px 75px, ${color} 100%, transparent 150%)`,
		];
		return patterns.join(', ');
	};

	// Desktop: Full pattern set
	const generateBackgroundImage = () => {
		const patterns = [
			// Row 1
			`radial-gradient(4px 100px at 0px 235px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 235px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 117.5px, ${color} 100%, transparent 150%)`,
			// Row 2
			`radial-gradient(4px 100px at 0px 252px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 252px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 126px, ${color} 100%, transparent 150%)`,
			// Row 3
			`radial-gradient(4px 100px at 0px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 150px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 75px, ${color} 100%, transparent 150%)`,
			// Row 4
			`radial-gradient(4px 100px at 0px 253px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 253px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 126.5px, ${color} 100%, transparent 150%)`,
			// Row 5
			`radial-gradient(4px 100px at 0px 204px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 204px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 102px, ${color} 100%, transparent 150%)`,
			// Row 6
			`radial-gradient(4px 100px at 0px 134px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 134px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 67px, ${color} 100%, transparent 150%)`,
			// Row 7
			`radial-gradient(4px 100px at 0px 179px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 179px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 89.5px, ${color} 100%, transparent 150%)`,
			// Row 8
			`radial-gradient(4px 100px at 0px 299px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 299px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 149.5px, ${color} 100%, transparent 150%)`,
			// Row 9
			`radial-gradient(4px 100px at 0px 215px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 215px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 107.5px, ${color} 100%, transparent 150%)`,
			// Row 10
			`radial-gradient(4px 100px at 0px 281px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 281px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 140.5px, ${color} 100%, transparent 150%)`,
			// Row 11
			`radial-gradient(4px 100px at 0px 158px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 158px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 79px, ${color} 100%, transparent 150%)`,
			// Row 12
			`radial-gradient(4px 100px at 0px 210px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(4px 100px at 300px 210px, ${color} 0%, ${color} 40%, transparent 100%)`,
			`radial-gradient(1.5px 1.5px at 150px 105px, ${color} 100%, transparent 150%)`,
		];

		return patterns.join(', ');
	};

	const backgroundSizes = [
		'300px 235px',
		'300px 235px',
		'300px 235px',
		'300px 252px',
		'300px 252px',
		'300px 252px',
		'300px 150px',
		'300px 150px',
		'300px 150px',
		'300px 253px',
		'300px 253px',
		'300px 253px',
		'300px 204px',
		'300px 204px',
		'300px 204px',
		'300px 134px',
		'300px 134px',
		'300px 134px',
		'300px 179px',
		'300px 179px',
		'300px 179px',
		'300px 299px',
		'300px 299px',
		'300px 299px',
		'300px 215px',
		'300px 215px',
		'300px 215px',
		'300px 281px',
		'300px 281px',
		'300px 281px',
		'300px 158px',
		'300px 158px',
		'300px 158px',
		'300px 210px',
		'300px 210px',
	].join(', ');

	// Mobile-optimized positions (shorter animation) - 24 patterns (8 columns x 3 per column)
	const mobileStartPositions = '0px 100px, 0px 200px, 0px 50px, 50px 100px, 50px 200px, 50px 50px, 100px 100px, 100px 200px, 100px 50px, 150px 100px, 150px 200px, 150px 50px, 200px 100px, 200px 200px, 200px 50px, 250px 100px, 250px 200px, 250px 50px, 300px 100px, 300px 200px, 300px 50px, 350px 100px, 350px 200px, 350px 50px';
	const mobileEndPositions = '0px 3000px, 0px 3200px, 0px 2950px, 50px 3000px, 50px 3200px, 50px 2950px, 100px 3000px, 100px 3200px, 100px 2950px, 150px 3000px, 150px 3200px, 150px 2950px, 200px 3000px, 200px 3200px, 200px 2950px, 250px 3000px, 250px 3200px, 250px 2950px, 300px 3000px, 300px 3200px, 300px 2950px, 350px 3000px, 350px 3200px, 350px 2950px';
	
	// Desktop: Full positions
	const startPositions =
		'0px 220px, 3px 220px, 151.5px 337.5px, 25px 24px, 28px 24px, 176.5px 150px, 50px 16px, 53px 16px, 201.5px 91px, 75px 224px, 78px 224px, 226.5px 230.5px, 100px 19px, 103px 19px, 251.5px 121px, 125px 120px, 128px 120px, 276.5px 187px, 150px 31px, 153px 31px, 301.5px 120.5px, 175px 235px, 178px 235px, 326.5px 384.5px, 200px 121px, 203px 121px, 351.5px 228.5px, 225px 224px, 228px 224px, 376.5px 364.5px, 250px 26px, 253px 26px, 401.5px 105px, 275px 75px, 278px 75px, 426.5px 180px';
	const endPositions =
		'0px 6800px, 3px 6800px, 151.5px 6917.5px, 25px 13632px, 28px 13632px, 176.5px 13758px, 50px 5416px, 53px 5416px, 201.5px 5491px, 75px 17175px, 78px 17175px, 226.5px 17301.5px, 100px 5119px, 103px 5119px, 251.5px 5221px, 125px 8428px, 128px 8428px, 276.5px 8495px, 150px 9876px, 153px 9876px, 301.5px 9965.5px, 175px 13391px, 178px 13391px, 326.5px 13540.5px, 200px 14741px, 203px 14741px, 351.5px 14848.5px, 225px 18770px, 228px 18770px, 376.5px 18910.5px, 250px 5082px, 253px 5082px, 401.5px 5161px, 275px 6375px, 278px 6375px, 426.5px 6480px';

	// Video fallback for mobile
	if (shouldUseVideo && videoSrc) {
		return (
			<div className={cn('relative h-full w-full', className)}>
				<video
					autoPlay
					loop
					muted
					playsInline
					className="absolute inset-0 w-full h-full object-cover"
					style={{ backgroundColor }}
				>
					<source src={videoSrc} type="video/webm" />
				</video>
				<div
					className="absolute inset-0 z-10 dark:brightness-[0.98]"
					style={{
						backdropFilter: `blur(${isMobile ? '0.5em' : blurIntensity})`,
						backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, ${backgroundColor} 2px)`,
						backgroundSize: `${8 * density}px ${8 * density}px`,
					}}
				/>
			</div>
		);
	}

	// Use reduced motion or mobile-optimized version
	const useMobileOptimized = isMobile || prefersReducedMotion;
	const finalBackgroundImage = useMobileOptimized 
		? generateMobileBackgroundImage()
		: generateBackgroundImage();
	const finalBackgroundSize = useMobileOptimized
		? '400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px, 400px 300px'
		: backgroundSizes;
	const finalStartPositions = useMobileOptimized ? mobileStartPositions : startPositions;
	const finalEndPositions = useMobileOptimized ? mobileEndPositions : endPositions;
	const finalDuration = useMobileOptimized ? duration * 0.6 : duration; // Faster on mobile
	const finalBlurIntensity = isMobile ? '0.5em' : blurIntensity; // Less blur on mobile

	return (
		<div className={cn('relative h-full w-full overflow-hidden', className)}>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="size-full"
			>
				<motion.div
					className="relative size-full z-0"
					style={{
						backgroundColor,
						backgroundImage: finalBackgroundImage,
						backgroundSize: finalBackgroundSize,
						filter: 'brightness(1.2) contrast(1.1)',
						// Performance optimizations for mobile
						willChange: 'background-position',
						transform: 'translateZ(0)', // Force hardware acceleration
					}}
					variants={{
						initial: {
							backgroundPosition: finalStartPositions,
						},
						animate: prefersReducedMotion
							? {
									backgroundPosition: finalStartPositions,
									transition: { duration: 0 },
								}
							: {
									backgroundPosition: [finalStartPositions, finalEndPositions],
									transition: {
										duration: finalDuration,
										ease: 'linear',
										repeat: Number.POSITIVE_INFINITY,
									},
								},
					}}
					initial="initial"
					animate="animate"
				/>
			</motion.div>
			<div
				className="absolute inset-0 z-10 dark:brightness-[0.98]"
				style={{
					backdropFilter: `blur(${finalBlurIntensity})`,
					backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, ${backgroundColor} 2px)`,
					backgroundSize: `${8 * density}px ${8 * density}px`,
					// Performance: reduce repaints
					willChange: 'transform',
				}}
			/>
		</div>
	);
}

