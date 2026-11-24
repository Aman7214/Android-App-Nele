import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchesListingSearch } from '../src/utils/listing-search.ts';

const house = {
  id: 'house', title: 'Independent house with courtyard', kind: 'House',
  locality: 'Bank Colony', town: 'raichur', mode: 'sale', beds: 4,
  price: 6800000, areaSqft: 2100, rating: 4.85, reviews: 31, image: 0,
};
const shop = {
  ...house, id: 'shop', title: 'Corner shop on Main Bazar', kind: 'Shop',
  locality: 'Main Bazar', town: 'manvi', mode: 'rent', beds: undefined,
};

test('blank searches restore the current listings', () => {
  assert.equal(matchesListingSearch(house, 'Raichur', '  '), true);
});

test('searches ignore case and extra whitespace', () => {
  assert.equal(matchesListingSearch(house, 'Raichur', '  BANK   Colony '), true);
});

test('multiple words can match across the type and town', () => {
  assert.equal(matchesListingSearch(shop, 'Manvi', 'shops manvi'), true);
});

test('every word must match the same listing', () => {
  assert.equal(matchesListingSearch(shop, 'Manvi', 'house manvi'), false);
});

test('property names can be searched', () => {
  assert.equal(matchesListingSearch(house, 'Raichur', 'courtyard'), true);
});

test('buy and rent searches match the correct deal mode', () => {
  assert.equal(matchesListingSearch(house, 'Raichur', 'buy'), true);
  assert.equal(matchesListingSearch(house, 'Raichur', 'rent'), false);
  assert.equal(matchesListingSearch(shop, 'Manvi', 'rent'), true);
});

test('bedroom searches work even when the title does not include BHK', () => {
  assert.equal(matchesListingSearch(house, 'Raichur', '4bhk'), true);
  assert.equal(matchesListingSearch(shop, 'Manvi', '4bhk'), false);
});

test('unmatched searches return no results', () => {
  assert.equal(matchesListingSearch(house, 'Raichur', 'swimming pool'), false);
});
