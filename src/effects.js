export function createEffects(canvas) {
  const context = canvas.getContext('2d');
  const particles = [];
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(quality = 1) {
    const count = 14 + Math.round(quality * 16);
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * .3;
      const speed = 45 + Math.random() * 120 * quality;
      particles.push({ x: width / 2, y: height * .47, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 600 + Math.random() * 500, age: 0, size: 1.5 + Math.random() * 3, hue: 142 + Math.random() * 45 });
    }
  }

  function update(elapsedMs) {
    context.clearRect(0, 0, width, height);
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.age += elapsedMs;
      if (particle.age >= particle.life) { particles.splice(index, 1); continue; }
      const seconds = elapsedMs / 1000;
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.vx *= .985;
      particle.vy *= .985;
      const alpha = 1 - particle.age / particle.life;
      context.beginPath();
      context.fillStyle = `hsla(${particle.hue} 90% 70% / ${alpha})`;
      context.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      context.fill();
    }
  }

  return { resize, burst, update };
}
