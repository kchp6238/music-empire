import { apiFetch } from './client';

export function getVenues() {
  return apiFetch('/concerts/venues');
}

export function holdConcert(venueId, ticketPrice) {
  return apiFetch('/concerts/hold', { method: 'POST', body: { venue_id: venueId, ticket_price: ticketPrice } });
}

export function getConcerts() {
  return apiFetch('/concerts');
}

export function createConcert(title, venueCapacity, ticketPrice, scheduledAt) {
  return apiFetch('/concerts', {
    method: 'POST',
    body: { title, venue_capacity: venueCapacity, ticket_price: ticketPrice, scheduled_at: scheduledAt },
  });
}

export function buyTicket(concertId) {
  return apiFetch(`/concerts/${concertId}/ticket`, { method: 'POST' });
}

export function getMarketplace() {
  return apiFetch('/marketplace');
}

export function createListing(songId, price) {
  return apiFetch('/marketplace', { method: 'POST', body: { song_id: songId, price } });
}

export function buyListing(listingId) {
  return apiFetch(`/marketplace/${listingId}/buy`, { method: 'POST' });
}
