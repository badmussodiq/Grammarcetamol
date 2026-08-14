/**
 * Component test for ContentTab — the module/lesson authoring UI in the course-editing
 * page. Mocks coursesApi at the module boundary (unlike the sibling *.integration.test.ts
 * files, which mock only fetch and exercise the real API client) so this stays focused on
 * rendering and interaction behavior: badges, the preview/allowDownload toggles, and the
 * edit panel.
 */
import type {ReactElement} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {ToastProvider} from '@grammarcetamol/utilities';
import {ContentTab} from '../../../../../app/(dashboard)/courses/[id]/ContentTab';
import {coursesApi, type ModuleResponse} from '@/lib/courses.api';

function renderWithProviders(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

vi.mock('@/lib/courses.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses.api')>();
  return {
    ...actual,
    coursesApi: {
      ...actual.coursesApi,
      updateLesson: vi.fn().mockResolvedValue({ success: true, data: {}, error: null, timestamp: '' }),
    },
  };
});

// LessonFileUpload drives a real multi-step network flow — out of scope for this component
// test (see LessonFileUpload/uploads.api's own integration test), so it's stubbed here.
vi.mock('../../../../../app/(dashboard)/courses/[id]/LessonFileUpload', () => ({
  LessonFileUpload: () => <div data-testid="lesson-file-upload-stub" />,
}));

function moduleWithOneLesson(overrides: Partial<ModuleResponse['lessons'][0]> = {}): ModuleResponse[] {
  return [
    {
      id: 'mod-1',
      title: 'Module 1',
      description: null,
      position: 0,
      published: true,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Lesson 1',
          description: null,
          type: 'video',
          duration: null,
          position: 0,
          videoUrl: null,
          uploadFileId: null,
          allowDownload: false,
          preview: false,
          published: true,
          ...overrides,
        },
      ],
    },
  ];
}

describe('ContentTab', () => {
  beforeEach(() => {
    vi.mocked(coursesApi.updateLesson).mockClear();
  });

  it('shows a "Missing video" warning badge when a video lesson has no url or uploaded file', () => {
    renderWithProviders(<ContentTab courseId="course-1" modules={moduleWithOneLesson()} onChanged={vi.fn()} />);
    expect(screen.getByText('Missing video')).toBeTruthy();
  });

  it('shows a "File uploaded" badge instead once an uploadFileId is attached', () => {
    renderWithProviders(<ContentTab courseId="course-1" modules={moduleWithOneLesson({ uploadFileId: 'file-1' })} onChanged={vi.fn()} />);
    expect(screen.getByText('File uploaded')).toBeTruthy();
    expect(screen.queryByText('Missing video')).toBeNull();
  });

  it('shows a "Preview" badge when the lesson is marked as a preview', () => {
    renderWithProviders(<ContentTab courseId="course-1" modules={moduleWithOneLesson({ preview: true, videoUrl: 'https://x.test/v.mp4' })} onChanged={vi.fn()} />);
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('clicking "Mark preview" calls coursesApi.updateLesson with preview:true and refreshes', async () => {
    const onChanged = vi.fn();
    renderWithProviders(<ContentTab courseId="course-1" modules={moduleWithOneLesson()} onChanged={onChanged} />);

    fireEvent.click(screen.getByText('Mark preview'));

    expect(coursesApi.updateLesson).toHaveBeenCalledWith('course-1', 'mod-1', 'lesson-1', { preview: true });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('the allowDownload checkbox reflects lesson state and toggling it calls updateLesson', async () => {
    const onChanged = vi.fn();
    const { container } = renderWithProviders(
      <ContentTab courseId="course-1" modules={moduleWithOneLesson({ allowDownload: false })} onChanged={onChanged} />,
    );

    fireEvent.click(screen.getByText('Edit'));
    const checkbox = screen.getByLabelText(/Allow students to download\/open this file directly/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    expect(coursesApi.updateLesson).toHaveBeenCalledWith('course-1', 'mod-1', 'lesson-1', { allowDownload: true });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(within(container).getByTestId('lesson-file-upload-stub')).toBeTruthy();
  });
});
