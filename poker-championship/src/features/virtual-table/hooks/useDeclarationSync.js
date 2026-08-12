import { useEffect, useRef } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';
import { removePlayers } from '../../../utils/pokerGameEngine';

/**
 * Watches playerDeclarations for changes and syncs the live game tables:
 * - Auto-removes cashed-out players
 * - Auto-adds newly declared players to the main table
 * - Auto-updates stacks when rebuys are added
 *
 * Uses runTransaction to read the freshest liveGame document from Firestore
 * so it NEVER overwrites newly dealt hole/community cards with stale state.
 */
export function useDeclarationSync({ isAuthenticated, liveGames, playerDeclarations, config }) {
  const prevDeclRef = useRef({});

  useEffect(() => {
    if (!isAuthenticated) return;

    // Diff: find players whose declaration actually changed
    const changed = Object.entries(playerDeclarations || {}).filter(
      ([pid, dec]) => JSON.stringify(dec) !== JSON.stringify(prevDeclRef.current[pid])
    );
    const prevKeys = Object.keys(prevDeclRef.current);
    const currKeys = Object.keys(playerDeclarations || {});
    const removed = prevKeys.filter(k => !currKeys.includes(k));

    if (changed.length === 0 && removed.length === 0) return;

    // Update baseline
    prevDeclRef.current = { ...(playerDeclarations || {}) };

    const tableIds = Object.keys(liveGames || { main: true });

    tableIds.forEach(async (tableId) => {
      try {
        const tableRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', tableId);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(tableRef);
          if (!snap.exists()) return;
          const game = snap.data();
          if (!game.active || !game.players) return;

          let changedLocal = false;
          let updatedPlayers = game.players.map(p => ({ ...p }));
          let nextDealerIndex = game.dealerIndex;
          let nextActingPlayerIndex = game.actingPlayerIndex;
          const processed = { ...(game.processedDeclarations || {}) };
          const historyAppend = [];

          // 1. Remove cashed-out players
          const cashedOutIds = updatedPlayers
            .filter(p => playerDeclarations?.[p.id]?.status === 'cashed_out')
            .map(p => p.id);

          if (cashedOutIds.length > 0) {
            cashedOutIds.forEach(id => {
              const name = updatedPlayers.find(p => p.id === id)?.name || id;
              historyAppend.push(`[Auto-Leave] ${name} left (cashed out).`);
              delete processed[id];
            });
            const result = removePlayers(updatedPlayers, cashedOutIds, nextDealerIndex, nextActingPlayerIndex);
            updatedPlayers = result.players;
            nextDealerIndex = result.dealerIndex;
            nextActingPlayerIndex = result.actingPlayerIndex;
            changedLocal = true;
          }

          // 2. Update stacks for rebuys
          updatedPlayers.forEach(p => {
            const dec = playerDeclarations?.[p.id];
            if (!dec) return;
            const oldBuyIn = Number(processed[p.id]?.buyIn || 0);
            const oldRebuys = Number(processed[p.id]?.rebuys || 0);
            const newBuyIn = Number(dec.buyIn || 0);
            const newRebuys = Number(dec.rebuys || 0);
            const diff = (newBuyIn + newRebuys) - (oldBuyIn + oldRebuys);
            if (diff > 0) {
              p.stack = Number(p.stack || 0) + diff;
              p.outOfChips = p.stack <= 0;
              processed[p.id] = { buyIn: newBuyIn, rebuys: newRebuys };
              changedLocal = true;
              historyAppend.push(`[Auto-Rebuy] ${p.name} stack +${diff.toLocaleString()} chips.`);
            }
          });

          // 3. Add new players (main table only)
          if (tableId === 'main') {
            const allSeatedIds = new Set(updatedPlayers.map(p => p.id));
            config.players.forEach(p => {
              const dec = playerDeclarations?.[p.id];
              if (dec?.status === 'active' && dec.buyIn > 0 && !allSeatedIds.has(p.id)) {
                const startingStack = Number(dec.buyIn || 0) + Number(dec.rebuys || 0);
                const isHandRunning = game.stage !== 'SETUP' && game.stage !== 'SHOWDOWN';
                updatedPlayers.push({
                  id: p.id, name: p.name, stack: startingStack,
                  currentBet: 0, totalHandInvestment: 0,
                  folded: isHandRunning, isAllIn: false, outOfChips: false, hasActed: isHandRunning,
                });
                processed[p.id] = { buyIn: Number(dec.buyIn), rebuys: Number(dec.rebuys) };
                changedLocal = true;
                historyAppend.push(`[Auto-Join] ${p.name} joined with ${startingStack.toLocaleString()} chips.`);
              }
            });
          }

          if (changedLocal) {
            tx.set(tableRef, {
              ...game,
              players: updatedPlayers,
              dealerIndex: nextDealerIndex,
              actingPlayerIndex: nextActingPlayerIndex,
              processedDeclarations: processed,
              history: [...(game.history || []), ...historyAppend],
              lastUpdated: new Date().toISOString(),
            });
          }
        });
      } catch (err) {
        console.error('Declaration sync error:', err);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, playerDeclarations]);
}
