
'use strict';

const storyForm = document.getElementById('storyForm');
const storyIdea = document.getElementById('storyIdea');
const createBtn = document.getElementById('createBtn');
const storyResult = document.getElementById('storyResult');

storyForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const idea = storyIdea.value.trim();

  if (!idea) {
    storyResult.textContent = 'Please enter a story idea first.';
    return;
  }

  createBtn.disabled = true;
  createBtn.innerHTML = '<span>CREATING YOUR STORY...</span><span>⟳</span>';
  storyResult.textContent = 'StoryForge is processing your idea...';

  try {
    const response = await fetch('/api/story-director', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ idea })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Story creation failed.');
    }

    storyResult.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    storyResult.textContent = 'Unable to create your story: ' + error.message;
  } finally {
    createBtn.disabled = false;
    createBtn.innerHTML = '<span>START CREATING</span><span>↗</span>';
  }
});
