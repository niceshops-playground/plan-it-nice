import type { RevealPolicy } from './types'

/** Whether a participant may *run the round* — reveal cards, start a new round,
 *  and change the deck — under the room's reveal policy. The host enforces this
 *  authoritatively and the UI uses it to enable/disable the controls, so both
 *  import this single source of truth and can never disagree. */
export function mayFacilitate(
  policy: RevealPolicy,
  who: { isHost: boolean; isObserver: boolean },
): boolean {
  switch (policy) {
    case 'anyone':
      return true
    case 'host':
      return who.isHost
    case 'observers':
      return who.isObserver
  }
}
