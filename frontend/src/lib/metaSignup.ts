/**
 * WhatsApp Embedded Signup (Facebook Login for Business SDK) + Instagram
 * connection via the classic Facebook Login OAuth dialog (Instagram Graph
 * API, reached through a connected Facebook Page — not a direct Instagram
 * login). Both flows end with the client logging into their OWN Meta account
 * and granting permission directly to Meta; we only ever receive the
 * resulting authorization `code`, exchanged server-side for a token (see
 * /api/channels/whatsapp/connect and /instagram/connect).
 *
 * IMPORTANT — two separate Meta apps: WhatsApp Embedded Signup below runs
 * through the Facebook JS SDK (`FB.init` / `FB.login`), which can only be
 * configured with ONE app id per page load, and that app id MUST have
 * "Login with the JavaScript SDK" enabled in Meta's dashboard, or FB.login()
 * fails with "JSSDK Option is Not Toggled". Instagram's connect flow (below,
 * `buildInstagramAuthUrl`) does NOT use the JS SDK at all — it's a plain
 * full-page OAuth redirect — so it never calls FB.init and can safely use a
 * different app id without conflicting with WhatsApp's. Both app ids come
 * from the backend's /channels/config response (`whatsappAppId` vs
 * `metaAppId`), which in turn read from separate env vars
 * (META_WHATSAPP_APP_ID vs META_APP_ID) — see channels.service.ts.
 */

declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let sdkScriptPromise: Promise<void> | null = null;
// Which app id FB.init() last ran with. The FB JS SDK is a single global —
// only one app id can be "active" at a time — so if something ever calls
// loadFacebookSdk with a DIFFERENT app id than what's currently active, we
// need to re-run FB.init for the new one rather than silently keeping
// whichever app id happened to load first. Not exercised today (only
// WhatsApp calls this), but cheap to guard against.
let initializedAppId: string | null = null;

/**
 * Loads the Facebook JS SDK (once) and calls FB.init for the given app id.
 * Safe to call multiple times, including with a different app id later —
 * re-initializes rather than reusing whichever app id loaded first.
 */
function loadFacebookSdk(appId: string): Promise<void> {
  const initForAppId = () => {
    if (initializedAppId === appId) return;
    // Check this log's appId against the Network tab's sdk.js / oauth
    // requests (see the "how to verify" notes) to confirm the right Meta
    // app is actually being used for this button.
    console.log('[metaSignup] FB.init() using appId:', appId);
    window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v21.0' });
    initializedAppId = appId;
  };

  if (sdkScriptPromise) return sdkScriptPromise.then(initForAppId);

  sdkScriptPromise = new Promise((resolve) => {
    window.fbAsyncInit = () => {
      initForAppId();
      resolve();
    };
    if (document.getElementById('facebook-jssdk')) {
      // Script tag already present from a previous mount — fbAsyncInit will fire once it loads.
      return;
    }
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });
  return sdkScriptPromise;
}

export interface WhatsAppSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}

/**
 * Launches the WhatsApp Embedded Signup popup. Resolves with the values our
 * backend needs to complete the connection, or rejects if the user closes the
 * popup or the flow errors — the caller shows "Connection failed, try again".
 */
export async function launchWhatsAppEmbeddedSignup(appId: string, configId: string): Promise<WhatsAppSignupResult> {
  await loadFacebookSdk(appId);

  return new Promise((resolve, reject) => {
    let wabaId: string | undefined;
    let phoneNumberId: string | undefined;
    let settled = false;

    const onMessage = (event: MessageEvent) => {
      // TEMP DEBUG: unconditional — fires for EVERY message event on window,
      // before any origin filtering. This is what tells us the RAW origin
      // Meta's WA_EMBEDDED_SIGNUP event actually arrives on, vs. what the
      // filter below currently expects (https://www.facebook.com /
      // https://web.facebook.com) — do not move this below the origin check.
      let rawEventData: string;
      try {
        rawEventData = JSON.stringify(event.data);
      } catch (err) {
        // event.data wasn't JSON-serializable (e.g. some unrelated postMessage
        // carrying a non-plain object) — fall back rather than losing the log.
        rawEventData = `<unserializable: ${String(err)}> ${String(event.data)}`;
      }
      console.log('[metaSignup] RAW window "message" event — event.origin:', event.origin, '| JSON.stringify(event.data):', rawEventData);

      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
        console.log('[metaSignup] ignoring message — origin is not facebook.com/web.facebook.com:', event.origin);
        return;
      }
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') {
          console.log('[metaSignup] ignoring message from facebook.com — not a WA_EMBEDDED_SIGNUP event, type was:', data?.type);
          return;
        }
        console.log('[metaSignup] WA_EMBEDDED_SIGNUP event matched — full payload:', JSON.stringify(data, null, 2));
        if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
          wabaId = data.data?.waba_id;
          phoneNumberId = data.data?.phone_number_id;
          console.log('[metaSignup] WA_EMBEDDED_SIGNUP', data.event, '— extracted wabaId:', wabaId, '| phoneNumberId:', phoneNumberId);
        }
        if (data.event === 'CANCEL' && !settled) {
          console.log('[metaSignup] WA_EMBEDDED_SIGNUP CANCEL received — rejecting');
          settled = true;
          console.log('[metaSignup] removing "message" listener (CANCEL path) at', Date.now());
          console.trace('[metaSignup] stack trace for removeEventListener("message") — CANCEL path');
          window.removeEventListener('message', onMessage);
          console.log('[metaSignup] removing "beforeunload" probe listener (CANCEL path) at', Date.now());
          window.removeEventListener('beforeunload', onBeforeUnload);
          reject(new Error('WhatsApp connection was cancelled'));
        }
      } catch (err) {
        // Not our message — ignore. (Logged, not silently swallowed, in case
        // a genuine WA_EMBEDDED_SIGNUP payload is failing to parse.)
        console.warn('[metaSignup] failed to JSON.parse a message event from facebook.com — ignoring it:', err, '| raw data:', event.data);
      }
    };
    // TEMP DEBUG: fires the moment the listener is actually registered, so
    // we can confirm from the console log ORDER that this runs BEFORE
    // FB.login() is called below (registration is synchronous — there is no
    // `await` between this line and the FB.login() call further down, so it
    // should always log first).
    window.addEventListener('message', onMessage);
    console.log('[metaSignup] "message" listener REGISTERED at Date.now() =', Date.now(), '(', new Date().toISOString(), ') — about to call FB.login() next');

    // TEMP DEBUG: diagnostic-only listener (not part of the real flow) — if
    // the page itself navigates/unloads while this signup is in progress
    // (as opposed to just the Meta popup closing), that would explain why no
    // postMessage from the popup is ever received. Torn down alongside the
    // "message" listener below.
    const onBeforeUnload = () => {
      console.log('[metaSignup] window "beforeunload" fired WHILE the WhatsApp signup flow was still in progress — this page (not just the popup) is navigating away or closing');
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    console.log('[metaSignup] "beforeunload" probe listener attached at', new Date().toISOString());

    const loginConfig = {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_embedded_signup', sessionInfoVersion: '3' },
    };
    console.log('[metaSignup] calling FB.login() with config:', JSON.stringify(loginConfig, null, 2));
    console.log('[metaSignup] FB.login() CALLED at Date.now() =', Date.now());

    window.FB!.login(
      (response) => {
        console.log('[metaSignup] FB.login() callback FIRED at Date.now() =', Date.now());
        console.log('[metaSignup] FB.login() callback — full raw response:', JSON.stringify(response, null, 2));
        console.log('[metaSignup] removing "message" listener (FB.login callback path) at', Date.now());
        console.trace('[metaSignup] stack trace for removeEventListener("message") — FB.login callback path');
        window.removeEventListener('message', onMessage);
        console.log('[metaSignup] removing "beforeunload" probe listener (FB.login callback path) at', Date.now());
        window.removeEventListener('beforeunload', onBeforeUnload);
        if (settled) {
          console.log('[metaSignup] FB.login() callback fired but the flow was already settled (e.g. cancelled) — ignoring');
          return;
        }
        settled = true;
        const code = response.authResponse?.code;
        console.log('[metaSignup] extracted code:', code, '| wabaId (from message events):', wabaId, '| phoneNumberId (from message events):', phoneNumberId);
        if (!code || !wabaId || !phoneNumberId) {
          console.error('[metaSignup] WhatsApp signup incomplete — missing code and/or wabaId and/or phoneNumberId:', { code, wabaId, phoneNumberId });
          reject(new Error('WhatsApp connection did not complete — please try again'));
          return;
        }
        console.log('[metaSignup] WhatsApp signup complete — resolving with:', { code, wabaId, phoneNumberId });
        resolve({ code, wabaId, phoneNumberId });
      },
      loginConfig,
    );
  });
}

/** Builds the Facebook Login OAuth URL for Instagram (redirect flow — no popup/JS SDK). */
export function buildInstagramAuthUrl(appId: string, graphVersion: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_messages,business_management,pages_messaging',
  });
  return `https://www.facebook.com/${graphVersion}/dialog/oauth?${params.toString()}`;
}

export function instagramRedirectUri(): string {
  return `${window.location.origin}/settings/channels/instagram/callback`;
}
