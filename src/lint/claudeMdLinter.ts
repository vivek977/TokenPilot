// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { getConfig } from '../config';

const COLLECTION_NAME = 'tokenPilot';

export function registerClaudeMdLinter(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  context.subscriptions.push(collection);

  // Lint any CLAUDE.md already open when the extension activates
  vscode.workspace.textDocuments.forEach(doc => lint(doc, collection));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => lint(doc, collection)),
    vscode.workspace.onDidChangeTextDocument(e => lint(e.document, collection)),
    vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)),
  );
}

function lint(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
  if (!isClaudeMd(doc)) { return; }

  const cfg  = getConfig();
  const text = doc.getText();
  const lines = text.split('\n');
  const diags: vscode.Diagnostic[] = [];

  // ── Line count heuristic ──────────────────────────────────────────────────
  if (lines.length > cfg.claudeMdMaxLines) {
    const range = new vscode.Range(cfg.claudeMdMaxLines, 0, lines.length - 1, 0);
    const diag  = new vscode.Diagnostic(
      range,
      `CLAUDE.md is ${lines.length} lines (limit: ${cfg.claudeMdMaxLines}). ` +
      `It is re-sent on every message — move verbose sections to .claude/skills/ or docs/.`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = "Venom's Token Pilot";
    diag.code   = 'claude-md-too-long';
    diags.push(diag);
  }

  // ── Token heuristic (chars ÷ 4) ──────────────────────────────────────────
  const estimatedTokens = Math.ceil(text.length / 4);
  if (estimatedTokens > cfg.claudeMdMaxTokens) {
    const range = new vscode.Range(0, 0, 0, lines[0].length);
    const diag  = new vscode.Diagnostic(
      range,
      `CLAUDE.md is ~${estimatedTokens} tokens (limit: ${cfg.claudeMdMaxTokens}). ` +
      `Each token costs quota on every turn. Trim or split into skills.`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = "Venom's Token Pilot";
    diag.code   = 'claude-md-too-many-tokens';
    diags.push(diag);
  }

  // ── Unfilled placeholder detection ───────────────────────────────────────
  lines.forEach((line, i) => {
    const m = line.match(/\{\{(\w+)\}\}/);
    if (m) {
      const col   = line.indexOf(m[0]);
      const range = new vscode.Range(i, col, i, col + m[0].length);
      const diag  = new vscode.Diagnostic(
        range,
        `Unfilled placeholder {{${m[1]}}} — replace with actual content or remove.`,
        vscode.DiagnosticSeverity.Information
      );
      diag.source = "Venom's Token Pilot";
      diag.code   = 'claude-md-placeholder';
      diags.push(diag);
    }
  });

  collection.set(doc.uri, diags);
}

function isClaudeMd(doc: vscode.TextDocument): boolean {
  return doc.fileName.endsWith('CLAUDE.md') || doc.fileName.endsWith('CLAUDE.local.md');
}
