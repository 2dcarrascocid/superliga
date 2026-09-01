import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStatusCode } from '../lambda_adapter.js';

test('resolveStatusCode mapea los códigos de inscripción de club/serie a torneo (no deben caer en 500)', () => {
  assert.equal(resolveStatusCode('TOURNAMENT_NOT_OPEN'), 422);
  assert.equal(resolveStatusCode('SEASON_NOT_ACTIVE'), 422);
  assert.equal(resolveStatusCode('CLUB_NOT_REGISTERED'), 422);
  assert.equal(resolveStatusCode('CATEGORY_MISMATCH'), 422);
  assert.equal(resolveStatusCode('CLUB_ORG_MISMATCH'), 403);
  assert.equal(resolveStatusCode('DUPLICATE_CLUB_REGISTRATION'), 409);
  assert.equal(resolveStatusCode('CLUB_HAS_REGISTERED_TEAMS'), 409);
  assert.equal(resolveStatusCode('INVALID_INSCRIPTION_FEE'), 400);
});

test('resolveStatusCode mapea los códigos del rol Jugador (T-20260828-103923)', () => {
  assert.equal(resolveStatusCode('MISSING_EMAIL'), 400);
  assert.equal(resolveStatusCode('NOT_A_PLAYER'), 403);
  assert.equal(resolveStatusCode('USER_ALREADY_LINKED_TO_ANOTHER_PLAYER'), 409);
  assert.equal(resolveStatusCode('INVALID_INVITE'), 410);
  assert.equal(resolveStatusCode('OAUTH_FAILED'), 401);
  assert.equal(resolveStatusCode('EMAIL_MISMATCH'), 403);
});

test('resolveStatusCode cae a 500 solo para códigos realmente no mapeados', () => {
  assert.equal(resolveStatusCode('ALGO_QUE_NO_EXISTE'), 500);
});
