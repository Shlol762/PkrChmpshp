import { useState } from 'react';
import { Trophy, Eye, Info, Power } from 'lucide-react';
import GameStatsBanner from './GameStatsBanner';
import TableSeatGrid from './TableSeatGrid';
import ActionControlPanel from './ActionControlPanel';
import ShowdownPanel from './ShowdownPanel';
import HostOverrides from './HostOverrides';
import TableManagement from './TableManagement';
import PlayerNotification from './PlayerNotification';
import CommunityCards from './CommunityCards';
import ManagePlayersModal from '../modals/ManagePlayersModal';
import SplitTableModal from '../modals/SplitTableModal';
import { useCardEngine } from '../hooks/useCardEngine';
import { submitPlayerAction } from '../hooks/useCommandQueue';

export default function ActiveGameScreen({
  // Auth & identity
  isAuthenticated,
  currentPlayerId, setCurrentPlayerId,
  // Config
  config,
  // Game data
  liveGame, liveGames, activeTables, activeTableId, setActiveTableId,
  // Spectator
  isSpectator, setIsSpectator,
  // Engine outputs
  totalLivePot, isStreetSettled, actingPlayer, minRaiseTo,
  selectedWinners, winnerPayouts,
  repositionMode, setRepositionMode,
  editingStack, setEditingStack, undoCount,
  showManualPanel, setShowManualPanel,
  manualAdjustPlayer, setManualAdjustPlayer,
  manualAdjustAmount, setManualAdjustAmount,
  manualAdjustReason, setManualAdjustReason,
  addPlayerStacks, setAddPlayerStacks,
  playerDeclarations,
  // Handlers
  handleAction,
  handleProceedNextStreet,
  handleAwardShowdown,
  handleManualAdjustment,
  handleResetGame,
  handleSaveToLedger,
  handleUndo,
  handleSkipTurn,
  handleSeatCardClick,
  handleSaveStackEdit,
  handleWinnerToggle,
  handlePayoutChange,
  handleTableSwap,
  handleSplitTable,
  updateDbState,
  gameDocRef,
}) {
  const [showManageTableModal, setShowManageTableModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);

  const isFullDigital = liveGame?.mode === 'full_digital';
  const { handleDealCards, handleDealCommunity } = useCardEngine({
    isAuthenticated, liveGame, activeTableId, updateDbState,
  });

  // Check if viewing user has folded or is spectating/admin
  const myPlayer = liveGame?.players?.find(p => p.id === currentPlayerId);
  const isViewerFolded = isAuthenticated || isSpectator || !currentPlayerId || myPlayer?.folded === true;

  // Handle "Proceed to next street"
  const handleProceedWithCards = async () => {
    await handleProceedNextStreet();
  };

  const handleActionClick = async (actionType, payload = null) => {
    if (isAuthenticated) {
      await handleAction(actionType, payload);
    } else {
      await submitPlayerAction(activeTableId, currentPlayerId, actionType, payload);
    }
  };

  const tableName = (id) => id === 'main' ? 'Table 1' : `Table ${id.split('_')[1] || id}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Table selector tabs */}
      {activeTables.length > 1 && (
        <div className="flex gap-2 mb-4 bg-zinc-950/60 p-1.5 rounded-2xl border border-white/5">
          {activeTables.map(table => {
            const isActive = table.id === activeTableId;
            return (
              <button
                key={table.id}
                onClick={() => setActiveTableId(table.id)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isActive ? 'bg-amber-500 text-amber-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <span>{tableName(table.id)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isActive ? 'bg-amber-600 text-amber-100' : 'bg-zinc-800 text-zinc-500'
                }`}>{table.players?.length || 0} Players</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Player notification toast */}
      {!isAuthenticated && currentPlayerId && (
        <PlayerNotification currentPlayerId={currentPlayerId} />
      )}

      {/* Player seat badge */}
      {!isAuthenticated && currentPlayerId && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 px-4 rounded-2xl flex items-center justify-between gap-2.5 text-sm font-semibold">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Playing as: <strong className="text-white">{config.players.find(p => p.id === currentPlayerId)?.name || currentPlayerId}</strong></span>
            {myPlayer?.folded && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Eye className="w-3 h-3" /> Folded (Spectator Mode Enabled)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTables.length > 1 && (() => {
              const myTable = activeTables.find(t => t.players?.some(p => p.id === currentPlayerId));
              if (myTable && myTable.id !== activeTableId) {
                return (
                  <button onClick={() => setActiveTableId(myTable.id)}
                    className="text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold border border-amber-500/20">
                    Go to {tableName(myTable.id)}
                  </button>
                );
              } else if (!myTable) {
                return (
                  <button onClick={() => handleActionClick('SWAP_TABLE', { targetTableId: activeTableId })}
                    className="text-xs text-amber-950 bg-amber-500 hover:bg-amber-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold">
                    Join This Table
                  </button>
                );
              } else {
                const otherTable = activeTables.find(t => t.id !== activeTableId);
                if (otherTable) return (
                  <button onClick={() => handleActionClick('SWAP_TABLE', { targetTableId: otherTable.id })}
                    className="text-xs text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold">
                    Swap to {tableName(otherTable.id)}
                  </button>
                );
              }
              return null;
            })()}
            <button
              onClick={() => {
                if (window.confirm('Vacate this seat?')) {
                  setCurrentPlayerId(null);
                  localStorage.removeItem('poker_player_id');
                  localStorage.removeItem('poker_player_pin');
                }
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold"
            >Leave Seat</button>
          </div>
        </div>
      )}

      {/* Spectator badge */}
      {!isAuthenticated && !currentPlayerId && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 py-3 px-4 rounded-2xl flex items-center justify-between gap-2.5 text-sm font-semibold">
          <div className="flex items-center gap-2.5"><Eye className="w-5 h-5" /><span>Spectator Mode (All Cards &amp; River Unlocked)</span></div>
          <button onClick={() => setIsSpectator(false)}
            className="text-xs text-amber-950 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer">
            Claim a Seat
          </button>
        </div>
      )}

      {liveGame ? (
        <>
          <GameStatsBanner liveGame={liveGame} totalLivePot={totalLivePot} />

          {/* Community cards (Mode C) */}
          {isFullDigital && (
            <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-5">
              <CommunityCards
                communityCards={liveGame.communityCards || []}
                remainingDeck={liveGame.remainingDeck || []}
                stage={liveGame.stage}
                isViewerFolded={isViewerFolded}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Right column: Controls (4 cols) */}
            <div className="lg:col-span-4 space-y-4">

              {/* Mode C: Deal cards button */}
              {isFullDigital && isAuthenticated && !liveGame.handDealt && liveGame.stage === 'PRE_FLOP' && (
                <button
                  onClick={handleDealCards}
                  className="w-full bg-blue-500 hover:bg-blue-400 text-blue-950 font-bold py-3.5 rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  🃏 Deal Hole Cards
                </button>
              )}

              {/* Action panel (non-showdown) */}
              {liveGame.stage !== 'SHOWDOWN' && (
                isAuthenticated ? (
                  <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4">
                    <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 border-b border-white/5 pb-2.5">Host Action Control</h3>
                    {actingPlayer ? (
                      <ActionControlPanel
                        key={actingPlayer.id}
                        actingPlayer={actingPlayer}
                        minRaiseTo={minRaiseTo}
                        totalLivePot={totalLivePot}
                        handleAction={handleActionClick}
                        liveGame={liveGame}
                        isAuthenticated={isAuthenticated}
                        isMyTurn={currentPlayerId && actingPlayer && actingPlayer.id === currentPlayerId}
                        layout="vertical"
                      />
                    ) : (
                      <div className="space-y-4 py-4 text-center">
                        <p className="text-sm text-zinc-400 font-medium">Host Controls / Advance Street</p>
                        <button
                          onClick={handleProceedWithCards}
                          className="w-full bg-blue-500 hover:bg-blue-400 text-blue-950 font-bold py-3.5 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 cursor-pointer text-sm"
                        >
                          Proceed to {liveGame.stage === 'PRE_FLOP' ? 'Flop' : liveGame.stage === 'FLOP' ? 'Turn' : liveGame.stage === 'TURN' ? 'River' : 'Showdown'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  currentPlayerId && actingPlayer && actingPlayer.id === currentPlayerId && !myPlayer?.folded ? (
                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4">
                      <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 border-b border-white/5 pb-2.5">Your Turn to Act</h3>
                      <ActionControlPanel
                        key={actingPlayer.id}
                        actingPlayer={actingPlayer}
                        minRaiseTo={minRaiseTo}
                        totalLivePot={totalLivePot}
                        handleAction={handleActionClick}
                        liveGame={liveGame}
                        layout="vertical"
                      />
                    </div>
                  ) : (
                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 text-center py-6 text-zinc-500 italic text-sm">
                      {myPlayer?.folded ? (
                        <div className="space-y-1">
                          <p className="text-amber-400 font-bold">You have folded.</p>
                          <p className="text-xs text-zinc-400">Spectator mode active: you can view everyone's cards and future board cards/river.</p>
                        </div>
                      ) : actingPlayer ? (
                        `Waiting for ${actingPlayer.name} to act...`
                      ) : isStreetSettled ? (
                        'Waiting for host to advance street...'
                      ) : (
                        'Waiting on players...'
                      )}
                    </div>
                  )
                )
              )}

              {/* Showdown for non-host */}
              {!isAuthenticated && liveGame.stage === 'SHOWDOWN' && (
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 text-center py-6 text-zinc-500 italic text-sm">
                  Showdown in progress. Waiting for host...
                </div>
              )}

              {/* Showdown payout (host only) */}
              {isAuthenticated && liveGame.stage === 'SHOWDOWN' && (
                <ShowdownPanel
                  liveGame={liveGame}
                  activeTableId={activeTableId}
                  totalLivePot={totalLivePot}
                  selectedWinners={selectedWinners}
                  winnerPayouts={winnerPayouts}
                  handleWinnerToggle={handleWinnerToggle}
                  handlePayoutChange={handlePayoutChange}
                  handleAwardShowdown={handleAwardShowdown}
                />
              )}

              {/* Host overrides */}
              {isAuthenticated && (
                <HostOverrides
                  liveGame={liveGame}
                  repositionMode={repositionMode} setRepositionMode={setRepositionMode}
                  undoCount={undoCount}
                  handleUndo={handleUndo} handleSkipTurn={handleSkipTurn}
                  showManualPanel={showManualPanel} setShowManualPanel={setShowManualPanel}
                  manualAdjustPlayer={manualAdjustPlayer} setManualAdjustPlayer={setManualAdjustPlayer}
                  manualAdjustAmount={manualAdjustAmount} setManualAdjustAmount={setManualAdjustAmount}
                  manualAdjustReason={manualAdjustReason} setManualAdjustReason={setManualAdjustReason}
                  handleManualAdjustment={handleManualAdjustment}
                />
              )}

              {/* Table management */}
              {isAuthenticated && (
                <TableManagement
                  isAuthenticated={isAuthenticated}
                  config={config}
                  liveGame={liveGame}
                  liveGames={liveGames}
                  activeTables={activeTables}
                  activeTableId={activeTableId}
                  playerDeclarations={playerDeclarations}
                  addPlayerStacks={addPlayerStacks} setAddPlayerStacks={setAddPlayerStacks}
                  handleTableSwap={handleTableSwap}
                  gameDocRef={gameDocRef}
                  onShowManagePlayers={() => setShowManageTableModal(true)}
                  onShowSplit={() => setShowSplitModal(true)}
                />
              )}

              {/* End / Reset session */}
              {isAuthenticated && (
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-2">
                  <button onClick={handleSaveToLedger}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-3 rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2 cursor-pointer">
                    <Power className="w-4 h-4" /> End &amp; Save Game
                  </button>
                  <button onClick={handleResetGame}
                    className="w-full bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-semibold py-2.5 rounded-2xl text-xs transition-all cursor-pointer">
                    Reset / Delete Live Table
                  </button>
                </div>
              )}

              {/* Spectator info */}
              {!isAuthenticated && (
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 flex gap-3 text-xs text-zinc-500 leading-relaxed">
                  <Info className="w-5 h-5 text-zinc-600 shrink-0" />
                  <div>
                    <p className="font-bold text-zinc-400">Live Viewer Active</p>
                    <p className="mt-1">Folded players &amp; spectators can view all active and folded hole cards plus the future board/river.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Left column: Table seats (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 relative min-h-[360px] flex flex-col justify-between">
                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                  <Trophy className="w-60 h-60 text-white" />
                </div>
                <div className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-4 pb-2 border-b border-white/5 flex justify-between items-center z-10">
                  <span>Table Seats</span>
                  <div className="flex items-center gap-3">
                    {repositionMode && (
                      <span className="text-amber-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">
                        Click a seat to set {repositionMode === 'dealer' ? 'Dealer' : 'Turn'}
                      </span>
                    )}
                    <span className="font-mono text-zinc-600">
                      Active: {liveGame.players.filter(p => !p.outOfChips && !p.folded).length}
                    </span>
                    {isFullDigital && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">💻 Digital</span>
                    )}
                  </div>
                </div>

                <TableSeatGrid
                  liveGame={liveGame}
                  isAuthenticated={isAuthenticated}
                  isSpectator={isSpectator}
                  repositionMode={repositionMode}
                  editingStack={editingStack}
                  setEditingStack={setEditingStack}
                  handleSeatCardClick={handleSeatCardClick}
                  handleSaveStackEdit={handleSaveStackEdit}
                  currentPlayerId={currentPlayerId}
                  activeTableId={activeTableId}
                />

                {/* History log */}
                <div className="mt-6 pt-4 border-t border-white/5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Recent History</span>
                  <div className="bg-zinc-950/60 border border-white/5 p-3.5 rounded-xl font-mono text-xs text-zinc-400 h-28 overflow-y-auto space-y-1">
                    {liveGame.history?.slice(-8).map((log, i) => (
                      <div key={i} className="leading-relaxed truncate">
                        <span className="text-zinc-600 mr-2 font-bold">&gt;</span>{log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center gap-3 text-center border-dashed">
          <Trophy className="w-10 h-10 text-zinc-700" />
          <p className="text-zinc-500 font-semibold text-sm">No active game table found.</p>
          <p className="text-zinc-600 text-xs max-w-xs">Start a new game from host controls, or wait for the host to set up a table.</p>
        </div>
      )}

      {/* Modals */}
      {showManageTableModal && liveGame && (
        <ManagePlayersModal
          liveGame={liveGame}
          config={config}
          playerDeclarations={playerDeclarations}
          gameDocRef={gameDocRef}
          activeTableId={activeTableId}
          onClose={() => setShowManageTableModal(false)}
        />
      )}

      {showSplitModal && liveGame && (
        <SplitTableModal
          liveGame={liveGame}
          activeTables={activeTables}
          handleSplitTable={handleSplitTable}
          onClose={() => setShowSplitModal(false)}
        />
      )}
    </div>
  );
}
