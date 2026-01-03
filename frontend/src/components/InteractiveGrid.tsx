import React, { useEffect, useState, useRef } from 'react';

const InteractiveGrid: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [gridSize, setGridSize] = useState({ rows: 0, cols: 0 });

    useEffect(() => {
        const updateGridSize = () => {
            if (containerRef.current) {
                const cellSize = 220; // Very large grids
                const { clientWidth, clientHeight } = containerRef.current;
                const cols = Math.ceil(clientWidth / cellSize) + 4;
                const rows = Math.ceil(clientHeight / cellSize) + 6;
                setGridSize({ rows, cols });
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };

        updateGridSize();
        window.addEventListener('resize', updateGridSize);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('resize', updateGridSize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // Parallax calculation
    const parallaxX = (mousePos.x - window.innerWidth / 2) * 0.05;
    const parallaxY = (mousePos.y - window.innerHeight / 2) * 0.05;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: '#000',
                overflow: 'hidden',
                zIndex: -1
            }}
        >
            <div
                ref={containerRef}
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridSize.cols}, 220px)`,
                    gridTemplateRows: `repeat(${gridSize.rows}, 220px)`,
                    position: 'absolute',
                    top: '-440px',
                    left: '-440px',
                    transform: `translate(${parallaxX}px, ${parallaxY}px)`,
                    transition: 'transform 0.1s ease-out',
                    animation: 'scrollDown 30s linear infinite',
                    zIndex: 1
                }}
            >
                {Array.from({ length: gridSize.rows * gridSize.cols }).map((_, i) => (
                    <GridItem key={i} />
                ))}
            </div>

            <style>{`
                @keyframes scrollDown {
                    from { margin-top: 0; }
                    to { margin-top: 220px; }
                }
            `}</style>

            {/* Vignette */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0.8) 100%)',
                pointerEvents: 'none',
                zIndex: 2
            }} />
        </div>
    );
};

const GridItem: React.FC = () => {
    const [isClicked, setIsClicked] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 1500);
    };

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onClick={() => setIsClicked(!isClicked)}
            style={{
                width: '220px',
                height: '220px',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                backgroundColor: isClicked ? '#a855f7' : (isHovered ? 'rgba(139, 92, 246, 0.15)' : 'transparent'),
                boxShadow: isClicked ? '0 0 30px rgba(168, 85, 247, 0.6)' : (isHovered ? '0 0 20px rgba(139, 92, 246, 0.2)' : 'none'),
                transition: 'all 0.4s ease',
                cursor: 'pointer',
                position: 'relative',
                zIndex: isClicked ? 10 : 1
            }}
        >
            {/* Inner glow lines */}
            <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.05)',
                pointerEvents: 'none'
            }} />
        </div>
    );
};

export default InteractiveGrid;
