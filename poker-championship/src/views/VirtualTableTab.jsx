import { useState, useMemo, useEffect } from 'react';
import { useGameEngine } from '../features/virtual-table/hooks/useGameEngine';
import { useCommandQueue } from '../features/virtual-table/hooks/useCommandQueue';
import { useDeclarationSync } from '../features/virtual-table/hooks/useDeclarationSync';
import GameSetupScreen from '../features/virtual-table/components/GameSetupScreen';
import ClaimSeatScreen from '../features/virtual-table/components/ClaimSeatScreen';
import ActiveGameScreen from '../features/virtual-table/components/ActiveGameScreen';

/**
 * VirtualTableTab — thin routing shell.
 *
 * Responsibilities:
 *   1. Determine which screen to show (Setup / ClaimSeat / Active)
 *   2. Instantiate the three hooks (engine, command queue, declaration sync)
 *   3. Pass all outputs down to the appropriate screen component
 *
 * All game logic lives in useGameEngine.
 * All Firestore sync side-effects live in useCommandQueue / useDeclarationSync.
 */
export default function VirtualTableTab({
  isAuthenticated,
  config,
  liveGames,
  currentDay,
  sessions,
  loans,
  currentPlayerId,
  setCurrentPlayerId,
  playerDeclarations,
}) {
  const [activeTableId, setActiveTableId] = useState('main');
  const [isSpectator, setIsSpectator]     = useState(false);

  // Collect all active tables
  const activeTables = useMemo(() => {
    return Object.entries(liveGames || {})
      .filter(([, game]) => game?.active)
      .map(([id, game]) => ({ id, ...game }));
  }, [liveGames]);

  // Auto-select active table where current player is seated
  useEffect(() => {
    if (activeTables.length > 0 && !activeTables.some(t => t.id === activeTableId)) {
      const playerTable = activeTables.find(t => t.players?.some(p => p.id === currentPlayerId));
      setActiveTableId(playerTable ? playerTable.id : activeTables[0].id);
    }
  }, [activeTables, activeTableId, currentPlayerId]);

  // Core game engine hook (all state + handlers)
  const engine = useGameEngine({
    isAuthenticated,
    config,
    liveGames,
    sessions,
    playerDeclarations,
    currentPlayerId,
    activeTableId,
    setActiveTableId,
  });

  // Command queue listener (host processes player commands)
  useCommandQueue({
    isAuthenticated,
    liveGames,
    activeTableId,
    handleAction: engine.handleAction,
    handleTableSwap: engine.handleTableSwap,
    currentPlayerId,
  });

  // Declaration sync (auto-join / auto-leave / rebuy)
  useDeclarationSync({
    isAuthenticated,
    liveGames,
    playerDeclarations,
    config,
  });

  const isAnyGameActive = activeTables.length > 0;
  const liveGame = engine.liveGame;

  // — Screen routing —

  // No game running, OR game is in LOBBY stage → Setup/Lobby screen
  if (!isAnyGameActive || liveGame?.stage === 'LOBBY') {
    return (
      <GameSetupScreen
        isAuthenticated={isAuthenticated}
        config={config}
        sbAmount={engine.sbAmount}                     setSbAmount={engine.setSbAmount}
        bbAmount={engine.bbAmount}                     setBbAmount={engine.setBbAmount}
        initialDealerId={engine.initialDealerId}       setInitialDealerId={engine.setInitialDealerId}
        handleStartGame={engine.handleStartGame}
        handleOpenLobby={engine.handleOpenLobby}
        liveGame={engine.liveGame}
      />
    );
  }

  // Game is active but player hasn't claimed a seat (and isn't spectator / admin)
  if (!isAuthenticated && !currentPlayerId && !isSpectator) {
    return (
      <ClaimSeatScreen
        config={config}
        liveGames={liveGames}
        setCurrentPlayerId={setCurrentPlayerId}
        setIsSpectator={setIsSpectator}
      />
    );
  }

  // Active game view
  return (
    <ActiveGameScreen
      isAuthenticated={isAuthenticated}
      currentPlayerId={currentPlayerId}
      setCurrentPlayerId={setCurrentPlayerId}
      config={config}
      liveGame={engine.liveGame}
      liveGames={liveGames}
      activeTables={activeTables}
      activeTableId={activeTableId}
      setActiveTableId={setActiveTableId}
      isSpectator={isSpectator}
      setIsSpectator={setIsSpectator}
      playerDeclarations={playerDeclarations}
      // Engine derived values
      totalLivePot={engine.totalLivePot}
      isStreetSettled={engine.isStreetSettled}
      actingPlayer={engine.actingPlayer}
      minRaiseTo={engine.minRaiseTo}
      selectedWinners={engine.selectedWinners}
      winnerPayouts={engine.winnerPayouts}
      repositionMode={engine.repositionMode}           setRepositionMode={engine.setRepositionMode}
      editingStack={engine.editingStack}               setEditingStack={engine.setEditingStack}
      undoCount={engine.undoCount}
      showManualPanel={engine.showManualPanel}         setShowManualPanel={engine.setShowManualPanel}
      manualAdjustPlayer={engine.manualAdjustPlayer}   setManualAdjustPlayer={engine.setManualAdjustPlayer}
      manualAdjustAmount={engine.manualAdjustAmount}   setManualAdjustAmount={engine.setManualAdjustAmount}
      manualAdjustReason={engine.manualAdjustReason}   setManualAdjustReason={engine.setManualAdjustReason}
      addPlayerStacks={engine.addPlayerStacks}         setAddPlayerStacks={engine.setAddPlayerStacks}
      // Engine handlers
      handleAction={engine.handleAction}
      handleProceedNextStreet={engine.handleProceedNextStreet}
      handleAwardShowdown={engine.handleAwardShowdown}
      handleManualAdjustment={engine.handleManualAdjustment}
      handleResetGame={engine.handleResetGame}
      handleSaveToLedger={engine.handleSaveToLedger}
      handleUndo={engine.handleUndo}
      handleSkipTurn={engine.handleSkipTurn}
      handleSeatCardClick={engine.handleSeatCardClick}
      handleSaveStackEdit={engine.handleSaveStackEdit}
      handleWinnerToggle={engine.handleWinnerToggle}
      handlePayoutChange={engine.handlePayoutChange}
      handleTableSwap={engine.handleTableSwap}
      handleSplitTable={engine.handleSplitTable}
      updateDbState={engine.updateDbState}
      gameDocRef={engine.gameDocRef}
    />
  );
}
