'use strict';

class StoryDirector {
  constructor(options = {}) {
    this.name = 'Story Director';
    this.id = 'storyDirector';
    this.provider = options.provider || null;
  }

  async run(context = {}) {
    const idea = String(context.idea || context.input?.idea || '').trim();

    if (!idea) {
      throw new Error('Story Director requires a story idea.');
    }

    // If a real AI provider is connected, use it.
    if (this.provider && typeof this.provider.generate === 'function') {
      return await this.provider.generate({
        role: this.name,
        task: 'Develop the supplied idea into a structured story concept.',
        idea
      });
    }

    // Local fallback mode
    return this.createLocalConcept(idea);
  }

  createLocalConcept(idea) {
    const lower = idea.toLowerCase();

    let genre = 'Adventure';

    if (/horror|ghost|haunted|scary/.test(lower)) {
      genre = 'Mystery';
    } else if (/robot|ai|space|future|technology/.test(lower)) {
      genre = 'Science Fiction';
    } else if (/magic|dragon|wizard|fantasy/.test(lower)) {
      genre = 'Fantasy';
    } else if (/school|student|teacher/.test(lower)) {
      genre = 'School Drama';
    }

    return {
      agent: this.name,
      mode: 'local',
      status: 'completed',

      concept: {
        originalIdea: idea,
        title: this.generateTitle(idea),
        genre,
        premise: idea,
        tone: 'Cinematic and engaging',
        audience: 'General audience',
        themes: this.detectThemes(lower),
        storyDirection: this.createDirection(genre),
        nextStage: 'Story Writer'
      },

      metadata: {
        generatedAt: new Date().toISOString(),
        aiPowered: false,
        providerConnected: Boolean(this.provider)
      }
    };
  }

  generateTitle(idea) {
    const words = idea
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5);

    if (!words.length) {
      return 'Untitled Story';
    }

    return words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  detectThemes(idea) {
    const themes = [];

    if (/friend|team|together|friendship/.test(idea)) {
      themes.push('Friendship and teamwork');
    }

    if (/danger|save|rescue|protect/.test(idea)) {
      themes.push('Courage and protection');
    }

    if (/mystery|secret|hidden|unknown/.test(idea)) {
      themes.push('Discovery and mystery');
    }

    if (/journey|travel|adventure|explore/.test(idea)) {
      themes.push('Exploration');
    }

    if (/school|learn|teacher|student/.test(idea)) {
      themes.push('Learning and growth');
    }

    if (!themes.length) {
      themes.push('Growth and discovery');
    }

    return themes;
  }

  createDirection(genre) {
    const directions = {
      Adventure: 'Build a journey with obstacles, discoveries, and a meaningful ending.',
      Mystery: 'Introduce clues gradually and build toward a surprising revelation.',
      'Science Fiction': 'Explore technology, unusual discoveries, and their consequences.',
      Fantasy: 'Create a distinctive world with extraordinary elements and challenges.',
      'School Drama': 'Build character relationships, conflicts, and meaningful school experiences.'
    };

    return directions[genre] || directions.Adventure;
  }
}

function createStoryDirector(options = {}) {
  return new StoryDirector(options);
}

module.exports = {
  StoryDirector,
  createStoryDirector
};

