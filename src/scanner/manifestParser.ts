export interface ManifestInfo {
  name: string;
  version: string;
  lang: 'node' | 'python' | 'unknown';
  scripts: Record<string, string>;
  depNames: string[];
  devDepNames: string[];
  entryPoints: string[];
}

export function parsePackageJson(text: string): ManifestInfo {
  const json = JSON.parse(text) as Record<string, unknown>;
  return {
    name:        String(json['name'] ?? 'unknown'),
    version:     String(json['version'] ?? '0.0.0'),
    lang:        'node',
    scripts:     (json['scripts'] as Record<string, string>) ?? {},
    depNames:    Object.keys((json['dependencies'] as object) ?? {}),
    devDepNames: Object.keys((json['devDependencies'] as object) ?? {}),
    entryPoints: [json['main'], json['module']].filter((v): v is string => typeof v === 'string'),
  };
}

export function parsePyprojectToml(text: string): ManifestInfo {
  const info: ManifestInfo = {
    name: 'unknown', version: '0.0.0', lang: 'python',
    scripts: {}, depNames: [], devDepNames: [], entryPoints: [],
  };

  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      section = line.replace(/\s/g, '');
      continue;
    }
    if (section === '[project]' || section === '[tool.poetry]') {
      const m = line.match(/^(name|version)\s*=\s*"([^"]+)"/);
      if (m) { if (m[1] === 'name') { info.name = m[2]; } else { info.version = m[2]; } }
    }
    if (section === '[project.scripts]' || section === '[tool.poetry.scripts]') {
      const m = line.match(/^([\w-]+)\s*=/);
      if (m) { info.scripts[m[1]] = ''; }
    }
    if (section === '[tool.poetry.dependencies]') {
      const m = line.match(/^([\w-]+)\s*=/);
      if (m && m[1] !== 'python') { info.depNames.push(m[1]); }
    }
  }
  return info;
}
