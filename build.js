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

// ── Generate blog list item HTML ──
function generateBlogCard(entry) {
  const f = entry.fields;
  const title    = f.title || 'Untitled';
  const slug     = f.slug || 'post';
  const excerpt  = f.excerpt || '';
  const tags     = Array.isArray(f.tags) ? f.tags : [];
  const readTime = f.readTime || 5;
  const date     = f.publishDate ? new Date(f.publishDate) : new Date();
  const dateStr  = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const tagsHtml = tags.map(tag =>
    `<span class="bg-secondary-fixed text-primary font-label-bold px-2 py-0.5 text-xs uppercase">${escapeHtml(tag)}</span>`
  ).join('\n                ');

  return `
        <a href="blog/${escapeHtml(slug)}.html" class="blog-card group block border-b-2 border-outline hover:border-secondary-fixed transition-colors py-8">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex-1">
              <div class="flex gap-2 items-center mb-3">
                ${tagsHtml}
                <span class="text-outline text-xs ml-2">${readTime} min read</span>
              </div>
              <h2 class="font-headline-lg text-[22px] font-black text-on-surface uppercase group-hover:text-secondary transition-colors">${escapeHtml(title.toUpperCase())}</h2>
              <p class="font-body-md text-body-md text-on-surface-variant mt-2 text-sm">${escapeHtml(excerpt)}</p>
            </div>
            <div class="flex flex-col items-end gap-2 shrink-0">
              <span class="font-label-bold text-label-bold text-outline uppercase">${dateStr}</span>
              <span class="material-symbols-outlined text-secondary-fixed opacity-0 group-hover:opacity-100 transition-opacity" style="font-size:28px;">arrow_forward</span>
            </div>
          </div>
          <div class="blog-card-bar h-0.5 w-0 bg-secondary-fixed transition-all duration-500 mt-4"></div>
        </a>`;
}

// ── Generate individual blog post HTML page ──
function generatePostPage(entry) {
  const f = entry.fields;
  const title    = f.title || 'Untitled';
  const tags     = Array.isArray(f.tags) ? f.tags : [];
  const readTime = f.readTime || 5;
  const body     = f.body || '';
  const date     = f.publishDate ? new Date(f.publishDate) : new Date();
  const dateStr  = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const tagsHtml = tags.map(tag =>
    `<span class="bg-secondary-fixed text-primary font-label-bold px-2 py-0.5 text-xs uppercase">${escapeHtml(tag)}</span>`
  ).join('\n            ');

  const bodyHtml = body
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => {
      const trimmed = p.trim();
      if (trimmed.startsWith('## '))
        return `<h2 class="font-headline-lg text-[22px] font-black text-on-surface uppercase mt-10 mb-4">${escapeHtml(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith('### '))
        return `<h3 class="font-label-bold text-base font-black text-on-surface uppercase mt-8 mb-3">${escapeHtml(trimmed.slice(4))}</h3>`;
      return `<p class="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-4">${escapeHtml(trimmed)}</p>`;
    })
    .join('\n          ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>${escapeHtml(title)} - KARUNESH.</title>
  <meta name="description" content="${escapeHtml(f.excerpt || title)}"/>
  <meta name="author" content="Karunesh Gupta"/>
  <meta property="og:title" content="${escapeHtml(title)} — KARUNESH."/>
  <meta property="og:description" content="${escapeHtml(f.excerpt || title)}"/>
  <meta property="og:type" content="article"/>
  <meta name="twitter:card" content="summary"/>
  <link rel="icon" type="image/svg+xml" href="../favicon.svg"/>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet"/>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            "outline-variant": "#c4c7c7", "primary": "#000000", "secondary-container": "#f6e611",
            "secondary-fixed": "#f6e611", "on-secondary-fixed": "#1f1c00", "background": "#f9f9f9",
            "surface": "#f9f9f9", "surface-container": "#eeeeee", "surface-container-low": "#f3f3f4",
            "surface-container-lowest": "#ffffff", "surface-container-highest": "#e2e2e2",
            "on-primary": "#ffffff", "on-surface": "#1a1c1c", "on-surface-variant": "#444748",
            "on-background": "#1a1c1c", "secondary": "#676000", "on-secondary": "#ffffff",
            "outline": "#747878", "inverse-on-surface": "#f0f1f1",
          },
          fontFamily: { "display-lg": ["Montserrat"], "headline-xl": ["Montserrat"], "headline-lg": ["Montserrat"], "body-lg": ["Inter"], "body-md": ["Inter"], "label-bold": ["Inter"] },
          fontSize: {
            "headline-xl": ["64px", { lineHeight: "72px", letterSpacing: "-0.02em", fontWeight: "800" }],
            "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "700" }],
            "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
            "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
            "label-bold": ["14px", { lineHeight: "20px", fontWeight: "700" }],
          },
          spacing: { "section-padding": "120px", "margin-desktop": "80px", "margin-mobile": "20px", "gutter": "24px" }
        }
      }
    }
  <\/script>
</head>
<body class="bg-surface text-on-surface font-body-md antialiased min-h-screen flex flex-col">
  <nav class="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-[80px] bg-primary border-b border-outline">
    <a href="../index.html" class="font-headline-lg text-headline-lg font-black tracking-tighter text-on-primary">KARUNESH.</a>
    <div class="hidden md:flex gap-gutter items-center">
      <a href="../index.html" class="font-label-bold text-label-bold text-on-primary opacity-80 hover:text-secondary transition-colors">HOME</a>
      <a href="../about.html" class="font-label-bold text-label-bold text-on-primary opacity-80 hover:text-secondary transition-colors">ABOUT</a>
      <a href="../projects.html" class="font-label-bold text-label-bold text-on-primary opacity-80 hover:text-secondary transition-colors">WORKS</a>
      <a href="../blog.html" class="font-label-bold text-label-bold text-secondary border-b-4 border-secondary pb-1">BLOG</a>
      <a href="../contact.html" class="font-label-bold text-label-bold text-on-primary opacity-80 hover:text-secondary transition-colors">CONTACT</a>
    </div>
    <a href="../contact.html" class="hidden md:block bg-secondary-fixed text-on-secondary-fixed font-label-bold text-label-bold px-6 py-2 hover:bg-primary hover:text-on-primary border-2 border-secondary-fixed hover:border-primary transition-all">HIRE ME</a>
  </nav>

  <main class="flex-grow pt-[80px]">
    <section class="py-20 px-margin-mobile md:px-margin-desktop bg-primary">
      <div class="max-w-4xl mx-auto">
        <a href="../blog.html" class="font-label-bold text-label-bold text-secondary-fixed uppercase tracking-widest hover:opacity-80 transition-opacity">← BACK TO BLOG</a>
      </div>
    </section>

    <article class="py-16 px-margin-mobile md:px-margin-desktop bg-surface-container-lowest">
      <div class="max-w-4xl mx-auto">
        <div class="flex gap-2 items-center mb-4">
          ${tagsHtml}
          <span class="text-outline text-xs ml-2">${readTime} min read</span>
        </div>
        <h1 class="font-headline-xl text-[36px] md:text-[48px] font-black text-on-surface leading-tight uppercase">${escapeHtml(title.toUpperCase())}</h1>
        <div class="flex items-center gap-4 mt-6 mb-12 pb-8 border-b-2 border-secondary-fixed">
          <span class="font-label-bold text-label-bold text-on-surface-variant uppercase">Karunesh Gupta</span>
          <span class="text-outline">•</span>
          <span class="font-label-bold text-label-bold text-outline uppercase">${dateStr}</span>
        </div>
        <div class="prose-content">
          ${bodyHtml}
        </div>
      </div>
    </article>
  </main>

  <footer class="bg-primary relative overflow-hidden">
    <div class="h-1.5 bg-secondary-fixed w-full"></div>
    <div class="max-w-6xl mx-auto px-margin-mobile md:px-margin-desktop py-16">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
        <div class="md:col-span-4">
          <a href="../index.html" class="font-headline-lg text-[36px] font-black text-on-primary tracking-tighter">KARUNESH.</a>
          <p class="font-body-md text-body-md text-on-primary opacity-50 mt-3 max-w-xs">DevOps &amp; Cloud Engineer automating AWS infrastructure, CI/CD and containers — engineered for uptime.</p>
          <div class="flex gap-3 mt-6">
            <a href="https://github.com/karunesh77" target="_blank" class="w-10 h-10 border-2 border-secondary-fixed flex items-center justify-center text-secondary-fixed hover:bg-secondary-fixed hover:text-primary transition-all"><span class="font-label-bold text-xs font-black">GH</span></a>
            <a href="https://www.linkedin.com/in/karunesh-gupta-680bb0326" target="_blank" class="w-10 h-10 border-2 border-secondary-fixed flex items-center justify-center text-secondary-fixed hover:bg-secondary-fixed hover:text-primary transition-all"><span class="font-label-bold text-xs font-black">IN</span></a>
            <a href="mailto:karunesh@elens.in" class="w-10 h-10 border-2 border-secondary-fixed flex items-center justify-center text-secondary-fixed hover:bg-secondary-fixed hover:text-primary transition-all"><span class="material-symbols-outlined" style="font-size:18px;">mail</span></a>
          </div>
        </div>
        <div class="md:col-span-2">
          <h4 class="font-label-bold text-label-bold text-secondary-fixed uppercase tracking-widest mb-4">Pages</h4>
          <div class="flex flex-col gap-3">
            <a href="../index.html" class="font-label-bold text-label-bold text-on-primary opacity-60 hover:opacity-100 hover:text-secondary-fixed transition-all uppercase">Home</a>
            <a href="../about.html" class="font-label-bold text-label-bold text-on-primary opacity-60 hover:opacity-100 hover:text-secondary-fixed transition-all uppercase">About</a>
            <a href="../projects.html" class="font-label-bold text-label-bold text-on-primary opacity-60 hover:opacity-100 hover:text-secondary-fixed transition-all uppercase">Works</a>
            <a href="../blog.html" class="font-label-bold text-label-bold text-on-primary opacity-60 hover:opacity-100 hover:text-secondary-fixed transition-all uppercase">Blog</a>
            <a href="../contact.html" class="font-label-bold text-label-bold text-on-primary opacity-60 hover:opacity-100 hover:text-secondary-fixed transition-all uppercase">Contact</a>
          </div>
        </div>
        <div class="md:col-span-3">
          <h4 class="font-label-bold text-label-bold text-secondary-fixed uppercase tracking-widest mb-4">Stack</h4>
          <div class="flex flex-wrap gap-2">
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">AWS</span>
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">Docker</span>
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">GitHub Actions</span>
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">ECS</span>
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">Lambda</span>
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">Linux</span>
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">Nginx</span>
            <span class="border border-outline text-on-primary opacity-60 font-label-bold px-2 py-1 text-xs uppercase">AWS CDK</span>
          </div>
        </div>
        <div class="md:col-span-3">
          <h4 class="font-label-bold text-label-bold text-secondary-fixed uppercase tracking-widest mb-4">Let's Work</h4>
          <p class="font-body-md text-body-md text-on-primary opacity-50 text-sm mb-4">Hiring for DevOps or Cloud? Let's keep your production fast, secure and always on.</p>
          <a href="../contact.html" class="inline-block bg-secondary-fixed text-primary font-label-bold text-label-bold px-6 py-2.5 uppercase hover:bg-on-primary hover:text-primary border-2 border-secondary-fixed hover:border-on-primary transition-all">Get In Touch</a>
        </div>
      </div>
    </div>
    <div class="border-t border-outline">
      <div class="max-w-6xl mx-auto px-margin-mobile md:px-margin-desktop py-5 flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="font-body-md text-body-md text-on-primary opacity-40 text-sm">© 2026 Karunesh Gupta. Engineered for uptime.</p>
        <button onclick="window.scrollTo({top:0,behavior:'smooth'})" class="font-label-bold text-label-bold text-secondary-fixed uppercase tracking-widest hover:opacity-70 transition-opacity flex items-center gap-1">
          Back to Top <span class="material-symbols-outlined" style="font-size:16px;">arrow_upward</span>
        </button>
      </div>
    </div>
  </footer>
</body>
</html>`;
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

    // Stats are matched by data-stat so they don't depend on the default numbers
    const setStat = (key, value) => {
      if (value == null) return;
      indexTemplate = indexTemplate.replace(
        new RegExp(`data-stat="${key}" data-target="\\d+"`),
        `data-stat="${key}" data-target="${value}"`
      );
    };
    setStat('years', c.statYears);
    setStat('projects', c.statProjects);
    setStat('stacks', c.statStacks);

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

  // ── Build blog.html ──
  console.log('\n📝  Building blog...');
  let blogTemplate = fs.readFileSync(path.join(__dirname, 'blog.html'), 'utf8');

  const blogRes = await safeFetch('blogPost', { order: '-fields.publishDate', limit: 100 });

  if (blogRes.items.length > 0) {
    const blogCardsHtml = blogRes.items.map(generateBlogCard).join('');
    blogTemplate = inject(blogTemplate, '<!-- BLOG_LIST_START -->', '<!-- BLOG_LIST_END -->', blogCardsHtml);

    const blogDir = path.join(distDir, 'blog');
    if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

    blogRes.items.forEach(entry => {
      const slug = entry.fields.slug || 'post';
      const postHtml = generatePostPage(entry);
      fs.writeFileSync(path.join(blogDir, `${slug}.html`), postHtml);
    });

    console.log(`  ✅ ${blogRes.items.length} blog posts built`);
  } else {
    console.log('  ℹ️  no "blogPost" entries — sample posts kept');
  }

  fs.writeFileSync(path.join(distDir, 'blog.html'), blogTemplate);

  // ── Copy remaining static pages ──
  console.log('\n📄  Copying static pages...');
  ['contact.html', '404.html'].forEach(copyToDist);

  // ── Copy static blog posts (fallback when no CMS entries) ──
  const srcBlog = path.join(__dirname, 'blog');
  const distBlog = path.join(distDir, 'blog');
  if (fs.existsSync(srcBlog) && blogRes.items.length === 0) {
    if (!fs.existsSync(distBlog)) fs.mkdirSync(distBlog, { recursive: true });
    fs.readdirSync(srcBlog).filter(f => f.endsWith('.html')).forEach(f => {
      fs.copyFileSync(path.join(srcBlog, f), path.join(distBlog, f));
      console.log(`  copied → dist/blog/${f}`);
    });
  }

  // ── Copy assets (whichever photo format exists) ──
  console.log('\n🖼   Copying assets...');
  ['profile.webp', 'profile.jpg', 'profile.png', 'favicon.svg', 'fx.css', 'fx.js'].forEach(f => {
    if (fs.existsSync(path.join(__dirname, f))) copyToDist(f);
  });

  console.log('\n🚀  Build complete → dist/\n');
}

build().catch(err => {
  console.error('\n❌  Build failed:', err.message);
  process.exit(1);
});
