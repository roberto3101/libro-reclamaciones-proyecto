import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function iniciarMovimiento() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({
    duration: 1.05,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anclas del nav pasan por Lenis
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const destino = document.querySelector(id);
      if (!destino) return;
      e.preventDefault();
      lenis.scrollTo(destino as HTMLElement, { offset: -72 });
    });
  });

  // Reveal por grupos: los hijos .rv de un mismo bloque entran escalonados
  document.querySelectorAll<HTMLElement>('[data-rv-grupo]').forEach((grupo) => {
    const piezas = grupo.querySelectorAll('.rv');
    if (!piezas.length) return;
    gsap.to(piezas, {
      opacity: 1,
      y: 0,
      duration: 0.72,
      ease: 'power2.out',
      stagger: 0.07,
      scrollTrigger: { trigger: grupo, start: 'top 82%', once: true },
    });
  });

  // Filetes que se dibujan al entrar
  document.querySelectorAll<HTMLElement>('[data-linea]').forEach((el) => {
    gsap.fromTo(el,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 0.9,
        ease: 'power3.out',
        transformOrigin: 'left center',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
  });
}
