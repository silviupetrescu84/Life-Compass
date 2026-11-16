import { createValuesScreen } from '../features/values/ValuesScreen';
import '../shared/styles/global.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root is missing.');

const header = document.createElement('header');
header.className = 'site-header';
header.innerHTML = `
  <a class="skip-link" href="#main-content">Skip to values</a>
  <div class="site-header__inner">
    <a class="brand" href="./" aria-label="Life Compass home">
      <svg class="brand__mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="17" stroke="currentColor" stroke-width="1.4"/><path d="m26 12-3 11-9 5 3-11 9-5Z" fill="currentColor"/><path d="m20 20 6-8-3 11-3-3Z" fill="#f7f8f2"/></svg>
      <span>Life Compass</span>
    </a>
    <span class="header-note">A space to find your direction</span>
  </div>
`;
app.append(header, createValuesScreen());
