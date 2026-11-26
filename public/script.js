'use strict';

/* =========================================
   STORYFORGE — HOME SCRIPT
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {

  // Smooth scrolling for internal navigation
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const targetId = link.getAttribute('href');

      if (!targetId || targetId === '#') return;

      const target = document.querySelector(targetId);

      if (target) {
        event.preventDefault();

        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Explore card hover interaction
  const cards = document.querySelectorAll('.explore-card');

  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.classList.add('card-active');
    });

    card.addEventListener('mouseleave', () => {
      card.classList.remove('card-active');
    });
  });

  // Hero entrance animation
  const heroContent = document.querySelector('.hero-content');

  if (heroContent) {
    heroContent.classList.add('hero-loaded');
  }

  // Homepage initialization
  console.log('StoryForge Home initialized successfully.');

});
