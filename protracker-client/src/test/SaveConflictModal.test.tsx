import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SaveConflictModal } from '../components/teams/lineup/SaveConflictModal';
import type { ConflictInfo } from '../components/teams/lineup/lineupWorkflowLogic';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) =>
      (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts?.[name] ?? '')),
    i18n: { language: 'en' }, // useLocaleFormat reads the active language
  }),
}));

const versionInfo: ConflictInfo = {
  kind: 'version',
  editedByName: 'Assistant Reyes',
  editedAt: '2026-07-30T18:45:00Z',
  currentVersion: 7,
};

function noop() {}

describe('SaveConflictModal — the never-a-silent-clobber dialog', () => {
  // APPROVAL-PINNED (refinement 1): a version conflict must show WHO edited
  // and WHEN so Overwrite is informed, not blind.
  it('version conflict shows the editor name, timestamp and current version', () => {
    render(
      <SaveConflictModal isOpen intent="conflict" info={versionInfo} saving={false}
        onOverwrite={noop} onReload={noop} onSaveAsNew={noop} onClose={noop} />,
    );
    expect(screen.getByText(/Assistant Reyes/)).toBeTruthy();
    // useLocaleFormat renders a locale datetime; assert the line exists with a year marker.
    expect(screen.getByText(/Last saved by/).textContent).toMatch(/2026/);
    expect(screen.getByText(/v7/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Overwrite/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reload latest/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Keep editing/ })).toBeTruthy();
  });

  it('overwrite and reload fire their callbacks', () => {
    const onOverwrite = vi.fn();
    const onReload = vi.fn();
    render(
      <SaveConflictModal isOpen intent="conflict" info={versionInfo} saving={false}
        onOverwrite={onOverwrite} onReload={onReload} onSaveAsNew={noop} onClose={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Overwrite/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reload latest/ }));
    expect(onOverwrite).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('an unknown editor renders a date-only line — never an invented name', () => {
    render(
      <SaveConflictModal isOpen intent="conflict" info={{ ...versionInfo, editedByName: null }} saving={false}
        onOverwrite={noop} onReload={noop} onSaveAsNew={noop} onClose={noop} />,
    );
    expect(screen.queryByText(/Last saved by/)).toBeNull();
    expect(screen.getByText(/Last saved/).textContent).toMatch(/2026/);
  });

  it('cross-target overwrite offers Overwrite but NOT Reload (nothing to reload into)', () => {
    render(
      <SaveConflictModal isOpen intent="crossTarget" info={versionInfo} saving={false}
        onOverwrite={noop} onReload={noop} onSaveAsNew={noop} onClose={noop} />,
    );
    expect(screen.getByText(/already saved here/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Overwrite/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reload latest/ })).toBeNull();
  });

  it('published lock explains and offers ONLY Close — no overwrite path exists', () => {
    render(
      <SaveConflictModal isOpen intent="conflict" info={{ ...versionInfo, kind: 'published' }} saving={false}
        onOverwrite={noop} onReload={noop} onSaveAsNew={noop} onClose={noop} />,
    );
    expect(screen.getByText(/published — unpublish it to make changes/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Overwrite/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save as new/ })).toBeNull();
    // Both the footer Close and the Modal's own X carry the "Close" name.
    expect(screen.getAllByRole('button', { name: /Close/ }).length).toBeGreaterThan(0);
  });

  it('deleted offers Save as new and Keep editing — never a silent re-create', () => {
    const onSaveAsNew = vi.fn();
    render(
      <SaveConflictModal isOpen intent="conflict"
        info={{ kind: 'deleted', editedByName: null, editedAt: null, currentVersion: null }} saving={false}
        onOverwrite={noop} onReload={noop} onSaveAsNew={onSaveAsNew} onClose={noop} />,
    );
    expect(screen.getByText(/no longer exists/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Save as new/ }));
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Overwrite/ })).toBeNull();
  });
});
