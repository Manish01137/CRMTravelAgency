import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from './api';

/**
 * Routes an API error to the right place: field-level validation errors land on
 * their form fields; everything else becomes a toast.
 */
export function handleApiError<T extends FieldValues>(
  err: unknown,
  setError?: UseFormSetError<T>,
): void {
  if (err instanceof ApiError) {
    const fieldErrors = err.fieldErrors;
    if (fieldErrors && setError) {
      let matched = false;
      for (const [key, messages] of Object.entries(fieldErrors)) {
        if (Array.isArray(messages) && messages.length > 0) {
          setError(key as Path<T>, { message: messages[0] });
          matched = true;
        }
      }
      if (matched) return;
    }
    toast.error(err.message);
    return;
  }
  toast.error('Something went wrong. Please try again.');
}
