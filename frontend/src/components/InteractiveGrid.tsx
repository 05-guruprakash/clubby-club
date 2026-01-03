import React, { useEffect, useRef } from 'react';

interface InteractiveGridProps {
    isDarkMode?: boolean;
}

const InteractiveGrid: React.FC<InteractiveGridProps> = ({ isDarkMode = true }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        // Configuration
        const particleCount = 100; // Number of particles
        const connectionDistance = 150; // Distance to draw lines
        const mouseDistance = 200; // Interaction radius
        const voltColor = { r: 188, g: 236, b: 21 }; // #bcec15

        let particles: Particle[] = [];
        let mouse = { x: -1000, y: -1000 };

        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            baseX: number;
            baseY: number;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.5; // Slow float speed
                this.vy = (Math.random() - 0.5) * 0.5;
                this.size = Math.random() * 2 + 1;
                this.baseX = this.x;
                this.baseY = this.y;
            }

            update() {
                // Mouse Interaction ("Antigravity" Repel Effect)
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const maxDistance = mouseDistance;
                const force = (maxDistance - distance) / maxDistance;
                const directionX = forceDirectionX * force * 5; // Strength of push
                const directionY = forceDirectionY * force * 5;

                if (distance < mouseDistance) {
                    this.x -= directionX;
                    this.y -= directionY;
                } else {
                    // Return to natural movement if not disturbed
                    if (this.x !== this.baseX) {
                        const dx = this.x - this.baseX;
                        this.x -= dx / 50; // Gentle elastic return (optional, or just float)
                    }
                    if (this.y !== this.baseY) {
                        const dy = this.y - this.baseY;
                        this.y -= dy / 50;
                    }
                    // Natural Floating
                    this.x += this.vx;
                    this.y += this.vy;
                    // Keep base updated to allow drifting
                    this.baseX += this.vx;
                    this.baseY += this.vy;
                }

                // Bounce off edges
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Wrap around edges for infinite feel (overrides bounce)
                if (this.x < 0) { this.x = width; this.baseX = width; }
                if (this.x > width) { this.x = 0; this.baseX = 0; }
                if (this.y < 0) { this.y = height; this.baseY = height; }
                if (this.y > height) { this.y = 0; this.baseY = 0; }
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${voltColor.r}, ${voltColor.g}, ${voltColor.b}, 1)`;
                ctx.fill();
            }
        }

        const init = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const connect = () => {
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x;
                    const dy = particles[a].y - particles[b].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < connectionDistance) {
                        const opacityValue = 1 - (distance / connectionDistance);
                        // Increased opacity multiplier from 0.5 to 0.8 for higher visibility
                        ctx.strokeStyle = `rgba(${voltColor.r}, ${voltColor.g}, ${voltColor.b}, ${opacityValue * 0.8})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            // Draw background explicitly per frame if needed, but we handle it via CSS on the div
            // This allows the particles to move cleanly.

            particles.forEach(p => {
                p.update();
                p.draw();
            });
            connect();
            requestAnimationFrame(animate);
        };

        init();
        animate();

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            init();
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        const handleMouseLeave = () => {
            mouse.x = -1000;
            mouse.y = -1000;
        }

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseLeave); // Reset on leave

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseLeave);
        };
    }, [isDarkMode]); // Re-init if mode changes (though color is static volt here)

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            // Darker gray for light mode to reduce "whiteness"
            background: isDarkMode ? '#050505' : '#e6e6e6',
            zIndex: -1,
            overflow: 'hidden',
            transition: 'background 0.5s ease'
        }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />

            {/* Optional subtle gradient overlay for depth */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: isDarkMode
                    ? 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 100%)'
                    : 'radial-gradient(circle at center, transparent 0%, rgba(255,255,255,0.1) 100%)', // Reduced opacity from 0.6 to 0.1
                pointerEvents: 'none'
            }} />
        </div>
    );
};

export default InteractiveGrid;
