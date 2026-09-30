import type { KeyboardEvent } from 'react';

/**
 * Enter in a text box submits the surrounding <form> by default. For long,
 * multi-step forms that means pressing Enter in any field (a search box, a
 * pasted image URL, a day title) saves and leaves the page mid-edit. Attach
 * to the <form>'s onKeyDown so only the Save buttons submit.
 */
export function preventEnterSubmit(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter') return;
  const t = e.target;
  if (t instanceof HTMLInputElement && !['submit', 'button', 'checkbox', 'radio'].includes(t.type)) e.preventDefault();
}
