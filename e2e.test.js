const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Scrum Poker Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('should load the welcome screen', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Scrum Poker');
    await expect(page.locator('.subtitle')).toContainText('Planning Poker for Agile Teams');
    await expect(page.locator('#user-name')).toBeVisible();
    await expect(page.locator('#room-id')).toBeVisible();
    await expect(page.locator('#join-btn')).toBeVisible();
  });

  test('should join a room with a name', async ({ page }) => {
    // Fill in user name
    await page.fill('#user-name', 'Alice');
    
    // Click join button
    await page.click('#join-btn');
    
    // Should show voting screen
    await expect(page.locator('#voting-screen')).toBeVisible();
    await expect(page.locator('#welcome-screen')).toHaveClass(/hidden/);
    
    // Should display room ID
    const roomId = await page.locator('#current-room-id').textContent();
    expect(roomId).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('should alert if name is empty', async ({ page }) => {
    // Setup dialog handler
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('enter your name');
      await dialog.accept();
    });
    
    // Click join without entering name
    await page.click('#join-btn');
    
    // Should remain on welcome screen
    await expect(page.locator('#welcome-screen')).not.toHaveClass(/hidden/);
  });

  test('should join a specific room', async ({ page }) => {
    const specificRoomId = 'TESTROOM';
    
    await page.fill('#user-name', 'Bob');
    await page.fill('#room-id', specificRoomId);
    await page.click('#join-btn');
    
    // Check room ID matches
    await expect(page.locator('#current-room-id')).toHaveText(specificRoomId);
  });

  test('should allow joining as observer', async ({ page }) => {
    await page.fill('#user-name', 'Observer');
    await page.check('#is-observer');
    await page.click('#join-btn');
    
    // Card selection should be hidden for observers
    const cardSelection = page.locator('#card-selection');
    await expect(cardSelection).toHaveCSS('display', 'none');
  });

  test('should display all card values', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    // Check all expected card values are present
    const expectedValues = ['0', '0.5', '1', '2', '3', '5', '8', '13', '21', '34', '55', '?', '☕'];
    
    for (const value of expectedValues) {
      const card = page.locator(`.card-button[data-value="${value}"]`);
      await expect(card).toBeVisible();
    }
  });

  test('should select a card when clicked', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    // Click on a card
    const card = page.locator('.card-button[data-value="5"]');
    await card.click();
    
    // Card should be selected
    await expect(card).toHaveClass(/selected/);
  });

  test('should deselect a card when clicked twice', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    const card = page.locator('.card-button[data-value="8"]');
    const participantVote = page.locator('.participant-vote').first();
    
    // Initially should show "..."
    await expect(participantVote).toContainText('...');
    
    // First click - select
    await card.click();
    await expect(card).toHaveClass(/selected/);
    
    // Should show checkmark after voting
    await expect(participantVote).toContainText('✓');
    
    // Second click - deselect
    await card.click();
    
    // Should go back to "..." after deselecting
    await expect(participantVote).toContainText('...');
    await expect(card).not.toHaveClass(/selected/);
  });

  test('should only allow one card to be selected at a time', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    const card1 = page.locator('.card-button[data-value="3"]');
    const card2 = page.locator('.card-button[data-value="5"]');
    
    // Select first card
    await card1.click();
    await expect(card1).toHaveClass(/selected/);
    
    // Select second card
    await card2.click();
    await expect(card2).toHaveClass(/selected/);
    await expect(card1).not.toHaveClass(/selected/);
  });

  test('should show voted status in participants list', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    // Wait for participant card to appear
    await expect(page.locator('.participant-card')).toBeVisible();
    
    // Initially should show "..."
    await expect(page.locator('.participant-vote')).toContainText('...');
    
    // Vote
    await page.click('.card-button[data-value="5"]');
    
    // Should show checkmark
    await expect(page.locator('.participant-vote')).toContainText('✓');
  });

  test('should copy room ID to clipboard', async ({ page }) => {
    await page.fill('#user-name', 'Alice');
    await page.click('#join-btn');
    
    // Get room ID
    const roomIdText = await page.locator('#current-room-id').textContent();
    
    // Grant clipboard permissions and click copy button
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.click('#copy-room-id');
    
    // Verify button changes to checkmark
    await expect(page.locator('#copy-room-id')).toContainText('✓');
    
    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(roomIdText);
  });

  test('should leave room and return to welcome screen', async ({ page }) => {
    await page.fill('#user-name', 'Alice');
    await page.click('#join-btn');
    
    // Click leave room
    await page.click('#leave-room');
    
    // Should be back on welcome screen
    await expect(page.locator('#welcome-screen')).not.toHaveClass(/hidden/);
    await expect(page.locator('#voting-screen')).toHaveClass(/hidden/);
  });

  test('should disable reveal button when no votes', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    // Reveal button should be disabled initially
    await expect(page.locator('#reveal-btn')).toBeDisabled();
  });

  test('should enable reveal button after voting', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    // Vote
    await page.click('.card-button[data-value="5"]');
    
    // Reveal button should be enabled
    await expect(page.locator('#reveal-btn')).toBeEnabled();
  });

  test('should disable reset button before reveal', async ({ page }) => {
    await page.fill('#user-name', 'Voter');
    await page.click('#join-btn');
    
    // Reset button should be disabled
    await expect(page.locator('#reset-btn')).toBeDisabled();
  });
});

test.describe('Multi-user Collaboration', () => {
  test('should allow multiple users in the same room', async ({ browser }) => {
    const roomId = 'MULTITEST';
    
    // Create two contexts for two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // User 1 joins
    await page1.goto(BASE_URL);
    await page1.fill('#user-name', 'Alice');
    await page1.fill('#room-id', roomId);
    await page1.click('#join-btn');
    
    // User 2 joins same room
    await page2.goto(BASE_URL);
    await page2.fill('#user-name', 'Bob');
    await page2.fill('#room-id', roomId);
    await page2.click('#join-btn');
    
    // Wait for both users to see each other
    await expect(page1.locator('#participant-count')).toHaveText('2');
    await expect(page2.locator('#participant-count')).toHaveText('2');
    
    // Check participant names
    await expect(page1.locator('.participant-name')).toContainText(['Alice', 'Bob']);
    await expect(page2.locator('.participant-name')).toContainText(['Alice', 'Bob']);
    
    await context1.close();
    await context2.close();
  });

  test('should show real-time voting updates', async ({ browser }) => {
    const roomId = 'VOTETEST';
    
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both join the same room
    await page1.goto(BASE_URL);
    await page1.fill('#user-name', 'Alice');
    await page1.fill('#room-id', roomId);
    await page1.click('#join-btn');
    
    await page2.goto(BASE_URL);
    await page2.fill('#user-name', 'Bob');
    await page2.fill('#room-id', roomId);
    await page2.click('#join-btn');
    
    // Alice votes
    await page1.click('.card-button[data-value="5"]');
    
    // Bob should see Alice voted (but not the value)
    const aliceCard = page2.locator('.participant-card').filter({ hasText: 'Alice' });
    await expect(aliceCard.locator('.participant-vote')).toContainText('✓');
    
    await context1.close();
    await context2.close();
  });

  test('should reveal cards and show statistics', async ({ browser }) => {
    const roomId = 'REVEALTEST';
    
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both join
    await page1.goto(BASE_URL);
    await page1.fill('#user-name', 'Alice');
    await page1.fill('#room-id', roomId);
    await page1.click('#join-btn');
    
    await page2.goto(BASE_URL);
    await page2.fill('#user-name', 'Bob');
    await page2.fill('#room-id', roomId);
    await page2.click('#join-btn');
    
    // Both vote
    await page1.click('.card-button[data-value="3"]');
    await page2.click('.card-button[data-value="5"]');
    
    // Alice reveals
    await page1.click('#reveal-btn');
    
    // Both should see statistics
    await expect(page1.locator('#statistics')).toBeVisible();
    await expect(page2.locator('#statistics')).toBeVisible();
    
    // Check statistics values
    await expect(page1.locator('#stat-min')).toContainText('3');
    await expect(page1.locator('#stat-max')).toContainText('5');
    await expect(page1.locator('#stat-median')).toContainText('4');
    await expect(page1.locator('#stat-avg')).toContainText('4');
    
    // Both should see actual votes
    const aliceCard = page2.locator('.participant-card').filter({ hasText: 'Alice' });
    await expect(aliceCard.locator('.participant-vote')).toContainText('3');
    
    const bobCard = page1.locator('.participant-card').filter({ hasText: 'Bob' });
    await expect(bobCard.locator('.participant-vote')).toContainText('5');
    
    await context1.close();
    await context2.close();
  });

  test('should reset votes for new round', async ({ browser }) => {
    const roomId = 'RESETTEST';
    
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both join
    await page1.goto(BASE_URL);
    await page1.fill('#user-name', 'Alice');
    await page1.fill('#room-id', roomId);
    await page1.click('#join-btn');
    
    await page2.goto(BASE_URL);
    await page2.fill('#user-name', 'Bob');
    await page2.fill('#room-id', roomId);
    await page2.click('#join-btn');
    
    // Vote and reveal
    await page1.click('.card-button[data-value="8"]');
    await page2.click('.card-button[data-value="13"]');
    await page1.click('#reveal-btn');
    
    // Statistics should be visible
    await expect(page1.locator('#statistics')).toBeVisible();
    
    // Reset
    await page1.click('#reset-btn');
    
    // Statistics should be hidden
    await expect(page1.locator('#statistics')).toHaveClass(/hidden/);
    await expect(page2.locator('#statistics')).toHaveClass(/hidden/);
    
    // Votes should be cleared
    await expect(page1.locator('.participant-vote').first()).toContainText('...');
    await expect(page2.locator('.participant-vote').first()).toContainText('...');
    
    // Selected cards should be cleared
    await expect(page1.locator('.card-button.selected')).toHaveCount(0);
    await expect(page2.locator('.card-button.selected')).toHaveCount(0);
    
    await context1.close();
    await context2.close();
  });

  test('should handle observer not affecting statistics', async ({ browser }) => {
    const roomId = 'OBSERVERTEST';
    
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // User joins as voter
    await page1.goto(BASE_URL);
    await page1.fill('#user-name', 'Voter');
    await page1.fill('#room-id', roomId);
    await page1.click('#join-btn');
    
    // User joins as observer
    await page2.goto(BASE_URL);
    await page2.fill('#user-name', 'Observer');
    await page2.fill('#room-id', roomId);
    await page2.check('#is-observer');
    await page2.click('#join-btn');
    
    // Verify observer badge
    const observerCard = page1.locator('.participant-card.observer');
    await expect(observerCard).toBeVisible();
    await expect(observerCard.locator('.participant-badge')).toContainText('Observer');
    
    // Voter votes
    await page1.click('.card-button[data-value="5"]');
    
    // Reveal
    await page1.click('#reveal-btn');
    
    // Statistics should only include voter's vote
    await expect(page1.locator('#stat-avg')).toContainText('5');
    await expect(page1.locator('#stat-min')).toContainText('5');
    await expect(page1.locator('#stat-max')).toContainText('5');
    
    await context1.close();
    await context2.close();
  });

  test('should allow room creator to remove participants', async ({ browser }) => {
    const roomId = 'REMOVETEST';
    
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Creator joins first
    await page1.goto(BASE_URL);
    await page1.fill('#user-name', 'Creator');
    await page1.fill('#room-id', roomId);
    await page1.click('#join-btn');
    
    // Second user joins
    await page2.goto(BASE_URL);
    await page2.fill('#user-name', 'Participant');
    await page2.fill('#room-id', roomId);
    await page2.click('#join-btn');
    
    // Both should see 2 participants
    await expect(page1.locator('#participant-count')).toHaveText('2');
    await expect(page2.locator('#participant-count')).toHaveText('2');
    
    // Creator should see remove button on participant's card
    const participantCard = page1.locator('.participant-card').filter({ hasText: 'Participant' });
    const removeBtn = participantCard.locator('.remove-participant-btn');
    await expect(removeBtn).toBeVisible();
    
    // Non-creator should NOT see remove button on creator's card
    const creatorCard = page2.locator('.participant-card').filter({ hasText: 'Creator' });
    const removeBtnOnPage2 = creatorCard.locator('.remove-participant-btn');
    await expect(removeBtnOnPage2).not.toBeVisible();
    
    // Setup dialog handler for confirmation
    page1.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Remove Participant');
      await dialog.accept();
    });
    
    // Setup alert handler for removed user
    let alertMessage = '';
    page2.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
    
    // Creator clicks remove button
    await removeBtn.click();
    
    // Wait for removal
    await page1.waitForTimeout(500);
    
    // Creator should now see only 1 participant
    await expect(page1.locator('#participant-count')).toHaveText('1');
    
    // Removed user should see alert and be back on welcome screen
    expect(alertMessage).toContain('removed from the room');
    await expect(page2.locator('#welcome-screen')).not.toHaveClass(/hidden/);
    await expect(page2.locator('#voting-screen')).toHaveClass(/hidden/);
    
    await context1.close();
    await context2.close();
  });
});
