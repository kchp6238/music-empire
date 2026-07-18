import { apiFetch } from './client';

export function invite(songId, inviteeCharacterId, role, contributionPct) {
  return apiFetch('/collab/invite', {
    method: 'POST',
    body: { song_id: songId, invitee_character_id: inviteeCharacterId, role, contribution_pct: contributionPct },
  });
}

export function getIncomingInvites() {
  return apiFetch('/collab/invites');
}

export function respondInvite(inviteId, accept) {
  return apiFetch(`/collab/invites/${inviteId}/respond`, { method: 'POST', body: { accept } });
}
