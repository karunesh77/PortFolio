/**
 * Portfolio Build Script
 * ---------------------
 * Fetches projects from Contentful and generates static HTML files.
 *
 * Contentful Content Type: "project"
 * Required fields:
 *   - title       (Short text)       → e.g. "HireMitra"
 *   - subtitle    (Short text)       → e.g. "Job Platform"
 *   - description (Short text)       → hover card text
 *   - category    (Short text, list) → ["fullstack", "cloud"]
 *   - tags        (Short text, list) → ["Next.js", "Express", "AWS"]
 *   - image       (Media)            → project screenshot/image
 *   - order       (Integer)          → display order (1, 2, 3...)
 * Optional fields:
 *   - liveUrl     (Short text)       → https://...
 *   - githubUrl   (Short text)       → https://github.com/...
 */

const contentful = require('contentful');
const fs = require('fs');
const path = require('path');

// ── Load .env file for local development ──
function loadEnv() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return;
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  });
}

// ── Escape HTML special characters ──
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Generate HTML for a single project card ──
function generateCard(entry) {
  const f = entry.fields;

  const title       = f.title || 'Untitled';
  const subtitle    = f.subtitle || '';
  const description = f.description || '';
  const categories  = Array.isArray(f.category) ? f.category : [f.category || 'project'];
  const tags        = Array.isArray(f.tags) ? f.tags : [];

  // Contentful asset URL (always starts with //)
  const imageUrl = f.image?.fields?.file?.url
    ? `https:${f.image.fields.file.url}?w=800&q=80`
    : 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&q=80';

  const dataCategory  = categories.join(' ');
  const primaryCat    = categories.find(c => c !== 'cloud') || categories[0] || 'project';

  // Pick the first cloud-related tag for the footer badge
  const cloudKeywords = ['aws', 's3', 'lambda', 'cdn', 'ci/cd', 'cloudfront'];
  const cloudTag = tags.find(t => cloudKeywords.some(k => t.toLowerCase().includes(k)));

  const tagsHtml = tags.map(tag =>
    `<span class="bg-primary text-on-primary font-label-bold px-3 py-1 text-xs uppercase">${escapeHtml(tag)}</span>`
  ).join('\n                ');

  const footerBadge = cloudTag
    ? `<div class="flex gap-1.5 items-center">
              <span class="bg-secondary-fixed text-primary font-label-bold px-2 py-1 text-xs uppercase">${escapeHtml(primaryCat)}</span>
              <span class="border border-secondary-fixed text-secondary-fixed font-label-bold px-2 py-1 text-xs uppercase">${escapeHtml(cloudTag)}</span>
            </div>`
    : `<span class="bg-secondary-fixed text-primary font-label-bold px-2 py-1 text-xs uppercase">${escapeHtml(primaryCat)}</span>`;

  return `
        <div class="project-card group relative overflow-hidden cursor-pointer" data-category="${escapeHtml(dataCategory)}">
          <div class="h-60 relative overflow-hidden">
            <img src="${imageUrl}" alt="${escapeHtml(title)}"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style="filter:grayscale(100%) brightness(0.55);"/>
            <div class="absolute inset-0 bg-secondary-fixed opacity-0 group-hover:opacity-90 transition-opacity duration-300 flex flex-col items-center justify-center p-6 text-center">
              <h3 class="font-headline-lg text-[22px] font-black text-primary mb-2">${escapeHtml(title.toUpperCase())}</h3>
              <p class="font-body-md text-body-md text-primary opacity-80 mb-3 text-sm">${escapeHtml(description)}</p>
              <div class="flex gap-2 flex-wrap justify-center">
                ${tagsHtml}
              </div>
            </div>
          </div>
          <div class="p-4 bg-primary border-t-2 border-secondary-fixed flex justify-between items-center">
            <div>
              <h3 class="font-label-bold text-base font-black text-on-primary uppercase">${escapeHtml(title.toUpperCase())}</h3>
              <p class="text-outline text-xs mt-0.5">${escapeHtml(subtitle)}</p>
            </div>
            ${footerBadge}
          </div>
        </div>`;
}

// ── Generate skill bar HTML ──
function generateSkillBar(entry) {
  const { name, level } = entry.fields;
  return `
          <div>
            <div class="flex justify-between mb-2">
              <span class="font-label-bold text-label-bold text-on-primary uppercase">${escapeHtml(name)}</span>
              <span class="font-label-bold text-label-bold text-secondary-fixed">${level}%</span>
            </div>
            <div class="w-full h-1 bg-outline">
              <div class="h-1 bg-secondary-fixed" style="width:${level}%"></div>
            </div>
          </div>`;
}

// ── Generate tech chip HTML ──
function generateChip(entry) {
  const { name, primary } = entry.fields;
  return primary
    ? `<span class="bg-secondary-fixed text-primary font-label-bold text-label-bold px-4 py-2 uppercase text-xs">${escapeHtml(name)}</span>`
    : `<span class="border border-outline text-on-primary font-label-bold text-label-bold px-4 py-2 uppercase text-xs">${escapeHtml(name)}</span>`;
}

// ── Inject content between markers in a template string ──
function inject(template, startMarker, endMarker, content) {
  const startIdx = template.indexOf(startMarker);
  const endIdx   = template.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return template;
  return (
    template.slice(0, startIdx + startMarker.length) +
    '\n' + content + '\n            ' +
    template.slice(endIdx)
  );
}

// ── Copy a file from root to dist/ ──
function copyToDist(filename) {
  const src = path.join(__dirname, filename);
  const dest = path.join(__dirname, 'dist', filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  copied → dist/${filename}`);
  }
}

// ── Main build ──
async function build() {
  loadEnv();

  const spaceId     = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;

  if (!spaceId || !accessToken) {
    console.error('\n❌  Set CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN in .env\n');
    process.exit(1);
  }

  // Ensure dist/ exists
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  console.log('\n📦  Fetching projects from Contentful...');
  const client = contentful.createClient({ space: spaceId, accessToken });

  const response = await client.getEntries({
    content_type: 'project',
    order: 'fields.order',
    limit: 100,
  });

  console.log(`✅  ${response.items.length} projects fetched`);

  // ── Inject cards into projects.html template ──
  const templatePath = path.join(__dirname, 'projects.html');
  let template = fs.readFileSync(templatePath, 'utf8');

  if (response.items.length === 0) {
    // No entries yet — keep hardcoded cards as-is
    fs.writeFileSync(path.join(distDir, 'projects.html'), template);
    console.log('ℹ️   No Contentful entries found — hardcoded cards kept');
  } else {
    const cardsHtml = response.items.map(generateCard).join('');

    const START = '<!-- PROJECTS_GRID_START -->';
    const END   = '<!-- PROJECTS_GRID_END -->';
    const startIdx = template.indexOf(START);
    const endIdx   = template.indexOf(END);

    if (startIdx === -1 || endIdx === -1) {
      console.error('❌  Markers missing in projects.html');
      process.exit(1);
    }

    const generated =
      template.slice(0, startIdx + START.length) +
      cardsHtml + '\n        ' +
      template.slice(endIdx);

    fs.writeFileSync(path.join(distDir, 'projects.html'), generated);
    console.log(`✅  projects.html built with ${response.items.length} Contentful projects`);
  }

  // ── Build about.html ──
  console.log('\n📄  Building about.html...');
  let aboutTemplate = fs.readFileSync(path.join(__dirname, 'about.html'), 'utf8');

  async function safeFetch(contentType, options = {}) {
    try {
      return await client.getEntries({ content_type: contentType, ...options });
    } catch {
      return { items: [] };
    }
  }

  const [aboutRes, skillsRes, chipsRes] = await Promise.all([
    safeFetch('about', { limit: 1 }),
    safeFetch('skill', { order: 'fields.order', limit: 100 }),
    safeFetch('techChip', { order: 'fields.order', limit: 100 }),
  ]);

  if (aboutRes.items.length > 0) {
    const { bio, cvUrl } = aboutRes.items[0].fields;

    if (bio) {
      const bioHtml = bio
        .split(/\n\n+/)
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtml(p.trim())}</p>`)
        .join('\n            ');
      aboutTemplate = inject(aboutTemplate, '<!-- ABOUT_BIO_START -->', '<!-- ABOUT_BIO_END -->', bioHtml);
      console.log('  ✅ bio injected');
    }

    aboutTemplate = aboutTemplate.replace('__CV_URL__', cvUrl || '#');
    console.log(cvUrl ? `  ✅ CV URL set: ${cvUrl}` : '  ℹ️  no CV URL — button disabled');
  } else {
    aboutTemplate = aboutTemplate.replace('__CV_URL__', '#');
    console.log('  ℹ️  no "about" entries — hardcoded bio kept');
  }

  if (skillsRes.items.length > 0) {
    const skillsHtml = skillsRes.items.map(generateSkillBar).join('');
    aboutTemplate = inject(aboutTemplate, '<!-- SKILLS_START -->', '<!-- SKILLS_END -->', skillsHtml);
    console.log(`  ✅ ${skillsRes.items.length} skills injected`);
  } else {
    console.log('  ℹ️  no "skill" entries — hardcoded skills kept');
  }

  if (chipsRes.items.length > 0) {
    const chipsHtml = chipsRes.items.map(generateChip).join('\n            ');
    aboutTemplate = inject(aboutTemplate, '<!-- TECH_CHIPS_START -->', '<!-- TECH_CHIPS_END -->', chipsHtml);
    console.log(`  ✅ ${chipsRes.items.length} tech chips injected`);
  } else {
    console.log('  ℹ️  no "techChip" entries — hardcoded chips kept');
  }

  fs.writeFileSync(path.join(distDir, 'about.html'), aboutTemplate);

  // ── Build index.html ──
  console.log('\n📄  Building index.html...');
  let indexTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  const configRes = await safeFetch('siteConfig', { limit: 1 });

  if (configRes.items.length > 0) {
    const c = configRes.items[0].fields;

    if (c.heroTagline) {
      indexTemplate = inject(indexTemplate, '<!-- HERO_TAGLINE_START -->', '<!-- HERO_TAGLINE_END -->', escapeHtml(c.heroTagline));
    }

    if (c.statYears != null) {
      indexTemplate = indexTemplate.replace(/data-target="3"/, `data-target="${c.statYears}"`);
    }
    if (c.statProjects != null) {
      indexTemplate = indexTemplate.replace(/data-target="10"/, `data-target="${c.statProjects}"`);
    }
    if (c.statStacks != null) {
      indexTemplate = indexTemplate.replace(/data-target="5"/, `data-target="${c.statStacks}"`);
    }

    if (Array.isArray(c.typingRoles) && c.typingRoles.length > 0) {
      indexTemplate = indexTemplate.replace(
        /\/\*ROLES_START\*\/.*?\/\*ROLES_END\*\//,
        `/*ROLES_START*/${JSON.stringify(c.typingRoles)}/*ROLES_END*/`
      );
    }

    console.log('  ✅ hero config injected from Contentful');
  } else {
    console.log('  ℹ️  no "siteConfig" entries — defaults kept');
  }

  fs.writeFileSync(path.join(distDir, 'index.html'), indexTemplate);

  // ── Copy remaining static pages ──
  console.log('\n📄  Copying static pages...');
  ['contact.html'].forEach(copyToDist);

  // ── Copy assets (whichever photo format exists) ──
  console.log('\n🖼   Copying assets...');
  ['profile.webp', 'profile.jpg', 'profile.png', 'favicon.svg'].forEach(f => {
    if (fs.existsSync(path.join(__dirname, f))) copyToDist(f);
  });

  console.log('\n🚀  Build complete → dist/\n');
}

build().catch(err => {
  console.error('\n❌  Build failed:', err.message);
  process.exit(1);
});
