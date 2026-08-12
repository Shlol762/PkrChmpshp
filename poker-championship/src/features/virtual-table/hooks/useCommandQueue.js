import { useEffect } from 'react';
import { doc, deleteDoc, addDoc, collection, onSnapshot, setDoc } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';

/**
 * Listens on the liveGameCommands collection (admin only).
 * Processes pending commands, marks them processed/rejected,
 * and writes a playerNotification for feedback.
 */
export function useCommandQueue({
  isAuthenticated,
  liveGames,
  activeTableId,
  handleAction,
  handleTableSwap,
  currentPlayerId,
}) {
  // ── Command processor (host-only listener) ───────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !liveGames) return;
    const commandsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands');
    const unsub = onSnapshot(commandsRef, async (snap) => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(cmd => !cmd.status || cmd.status === 'pending')
        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

      for (const cmd of docs) {
        const cmdTableId = cmd.tableId || 'main';

        try {
          if (cmd.action === 'SWAP_TABLE') {
            const targetTableId = cmd.payload?.targetTableId;
            if (targetTableId && liveGames[targetTableId]?.active) {
              await handleTableSwap(cmd.playerId, targetTableId);
              await writeNotification(cmd.playerId, `You joined Table ${targetTableId === 'main' ? '1' : targetTableId.split('_')[1] || targetTableId}.`, 'success');
            }
            await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands', cmd.id));
            continue;
          }

          const targetGame = liveGames[cmdTableId];
          if (!targetGame?.active) {
            await markCommand(cmd.id, 'rejected', 'No active game at this table.');
            continue;
          }

          const actingPlayerForTable = targetGame.actingPlayerIndex !== -1
            ? targetGame.players[targetGame.actingPlayerIndex]
            : null;

          if (actingPlayerForTable && cmd.playerId === actingPlayerForTable.id) {
            await handleAction(cmd.action, cmd.payload, cmdTableId);
            await writeNotification(cmd.playerId, `Your ${cmd.action} was applied.`, 'success');
          } else {
            const reason = !actingPlayerForTable ? 'No active turn.' : `It is ${actingPlayerForTable.name}'s turn, not yours.`;
            await writeNotification(cmd.playerId, `Action rejected: ${reason}`, 'error');
          }
        } catch (err) {
          console.error('Error processing command:', err);
          await writeNotification(cmd.playerId, 'Action could not be applied. Please try again.', 'error');
        }
        await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands', cmd.id));
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, liveGames]);
}

async function markCommand(cmdId, status, reason) {
  try {
    await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands', cmdId), { status, reason }, { merge: true });
  } catch { /* ignore */ }
}

export async function writeNotification(playerId, message, type = 'info') {
  try {
    await setDoc(
      doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerNotifications', playerId),
      { message, type, timestamp: new Date().toISOString() }
    );
  } catch { /* ignore */ }
}

/**
 * Submit an action to the command queue (used by non-host players).
 */
export async function submitPlayerAction(activeTableId, currentPlayerId, actionType, payload = null) {
  if (!currentPlayerId) return;
  const pin = localStorage.getItem('poker_player_pin') || '';
  try {
    await addDoc(
      collection(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands'),
      {
        tableId: activeTableId,
        playerId: currentPlayerId,
        action: actionType,
        payload,
        pin,
        status: 'pending',
        timestamp: new Date().toISOString(),
      }
    );
  } catch (err) {
    console.error('Action submission error:', err);
    alert('Failed to submit action. Please verify your seat PIN.');
  }
}
