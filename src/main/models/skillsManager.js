const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * SkillsManager — discovers, parses, and manages skills following the AgentSkills spec.
 * 
 * Skills use YAML frontmatter (name, description) + markdown body in SKILL.md files
 * inside named directories. Supports progressive disclosure:
 *   Tier 1 (catalog): name + description loaded at startup
 *   Tier 2 (instructions): full body loaded on activation
 *   Tier 3 (resources): bundled files loaded on demand
 */
class SkillsManager {
  constructor() {
    this.userSkillsDir = path.join(app.getPath('userData'), 'skills');
    this.bundledSkillsDir = path.join(__dirname, '..', '..', '..', 'skills');
    this.cache = null; // [{ name, description, location, metadata, body }]
    this.activated = new Set(); // track activated skill names per session
    this.disabledSkills = new Set(); // app-level disabled skills
  }

  async init() {
    await this._ensureDir(this.userSkillsDir);
    await this._seedBundledSkills();
    this.cache = await this._discoverAll();
    return this.cache;
  }

  /** Tier 1: catalog for system prompt — name + description only */
  getCatalog() {
    return (this.cache || [])
      .filter(s => !this.disabledSkills.has(s.name))
      .map(({ name, description }) => ({ name, description }));
  }

  /** Tier 2: full body for activation */
  async getSkillBody(name) {
    const skill = (this.cache || []).find(s => s.name === name);
    if (!skill) return null;
    if (skill.body !== undefined) return skill.body;
    // Lazy-load body from disk
    const content = await fs.readFile(skill.location, 'utf8');
    skill.body = this._extractBody(content);
    return skill.body;
  }

  /** Get the base directory of a skill (for resolving relative paths) */
  getSkillDir(name) {
    const skill = (this.cache || []).find(s => s.name === name);
    return skill ? path.dirname(skill.location) : null;
  }

  /** List bundled resource files in a skill directory */
  async listResources(name) {
    const dir = this.getSkillDir(name);
    if (!dir) return [];
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    return entries
      .filter(e => e.isFile() && e.name !== 'SKILL.md')
      .map(e => path.relative(dir, path.join(e.parentPath || e.path, e.name)));
  }

  /** Track activation — returns false if already activated (dedup) */
  markActivated(name) {
    if (this.activated.has(name)) return false;
    this.activated.add(name);
    return true;
  }

  isActivated(name) {
    return this.activated.has(name);
  }

  resetActivations() {
    this.activated.clear();
  }

  getSkills() {
    return this.cache || [];
  }

  getSkill(name) {
    return (this.cache || []).find(s => s.name === name) || null;
  }

  async toggleSkill(name, enabled) {
    if (enabled) {
      this.disabledSkills.delete(name);
    } else {
      this.disabledSkills.add(name);
    }
    return { name, enabled };
  }

  async refresh() {
    this.cache = await this._discoverAll();
    return this.cache;
  }

  async openSkillsFolder() {
    await shell.openPath(this.userSkillsDir);
  }

  // ── Discovery ──────────────────────────────────────────────────────────

  async _discoverAll() {
    const seen = new Map(); // name → skill (first wins for collision)
    const scanPaths = this._getScanPaths();

    for (const { dir, scope } of scanPaths) {
      const skills = await this._scanDirectory(dir);
      for (const skill of skills) {
        if (!seen.has(skill.name)) {
          seen.set(skill.name, { ...skill, scope });
        }
        // Project-level overrides user-level (project scanned first)
      }
    }
    return Array.from(seen.values());
  }

  _getScanPaths() {
    const home = os.homedir();
    const project = process.cwd();
    return [
      // Project-level (higher priority)
      { dir: path.join(project, '.agents', 'skills'), scope: 'project' },
      // User-level
      { dir: path.join(home, '.agents', 'skills'), scope: 'user' },
      // App-specific user dir (seeded from bundled)
      { dir: this.userSkillsDir, scope: 'app' },
    ];
  }

  async _scanDirectory(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return []; // Directory doesn't exist
    }

    const skills = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const skillFile = path.join(dir, entry.name, 'SKILL.md');
      try {
        const content = await fs.readFile(skillFile, 'utf8');
        const skill = this._parseSkillFile(content, skillFile);
        if (skill) skills.push(skill);
      } catch {
        // No SKILL.md in this directory — skip
      }
    }
    return skills;
  }

  // ── Parsing ────────────────────────────────────────────────────────────

  _parseSkillFile(content, filePath) {
    const frontmatter = this._extractFrontmatter(content);
    if (!frontmatter) return null;

    const { name, description } = frontmatter;
    if (!description || !description.trim()) return null; // spec: skip if no description

    const skillName = name || path.basename(path.dirname(filePath));

    return {
      name: skillName,
      description: description.trim(),
      location: filePath,
      metadata: frontmatter.metadata || {},
      license: frontmatter.license || null,
      compatibility: frontmatter.compatibility || null,
      allowedTools: frontmatter['allowed-tools'] || null,
      body: this._extractBody(content),
    };
  }

  _extractFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return null;

    try {
      return this._parseSimpleYaml(match[1]);
    } catch {
      // Try fixing common issue: unquoted colons
      try {
        const fixed = match[1].replace(
          /^(\w[\w-]*):\s+(.+:.+)$/gm,
          (_, key, val) => `${key}: "${val.replace(/"/g, '\\"')}"`
        );
        return this._parseSimpleYaml(fixed);
      } catch {
        return null;
      }
    }
  }

  /** Lightweight YAML parser for frontmatter (no dependency needed) */
  _parseSimpleYaml(text) {
    const result = {};
    let currentKey = null;
    let currentIndent = 0;
    let nestedObj = null;

    for (const line of text.split('\n')) {
      if (line.trim() === '' || line.trim().startsWith('#')) continue;

      const topMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (topMatch) {
        if (nestedObj && currentKey) {
          result[currentKey] = nestedObj;
          nestedObj = null;
        }
        const [, key, value] = topMatch;
        if (value.trim() === '') {
          // Could be start of nested map
          currentKey = key;
          currentIndent = 0;
          nestedObj = {};
        } else {
          result[key] = value.trim().replace(/^["']|["']$/g, '');
          currentKey = null;
          nestedObj = null;
        }
        continue;
      }

      // Nested key-value
      const nestedMatch = line.match(/^\s+(\w[\w-]*):\s*(.+)$/);
      if (nestedMatch && nestedObj) {
        nestedObj[nestedMatch[1]] = nestedMatch[2].trim().replace(/^["']|["']$/g, '');
      }
    }

    if (nestedObj && currentKey) {
      result[currentKey] = nestedObj;
    }

    return result;
  }

  _extractBody(content) {
    const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
  }

  // ── Seeding ────────────────────────────────────────────────────────────

  async _seedBundledSkills() {
    let entries;
    try {
      entries = await fs.readdir(this.bundledSkillsDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const srcSkill = path.join(this.bundledSkillsDir, entry.name, 'SKILL.md');
      const destDir = path.join(this.userSkillsDir, entry.name);
      const destSkill = path.join(destDir, 'SKILL.md');

      try {
        await fs.access(destSkill);
      } catch {
        // Doesn't exist — seed it
        await this._ensureDir(destDir);
        await this._copyDirRecursive(
          path.join(this.bundledSkillsDir, entry.name),
          destDir
        );
      }
    }
  }

  async _ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }

  async _copyDirRecursive(src, dest) {
    await this._ensureDir(dest);
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this._copyDirRecursive(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

module.exports = SkillsManager;
