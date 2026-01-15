import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {core} from '../../core/core';
import {ParticipantAnswerService} from '../../services/participant.answer';
import {ParticipantService} from '../../services/participant.service';

import {
  ConversationReplayStageConfig,
  ConversationReplayStageParticipantAnswer,
  createConversationReplayStageParticipantAnswer,
} from '@deliberation-lab/utils';
import {ChatMessage} from '@deliberation-lab/utils';

import {styles} from './conversation_replay_participant_view.scss';

/** Conversation replay participant view */
@customElement('conversation-replay-participant-view')
export class ConversationReplayParticipantView extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property() stage: ConversationReplayStageConfig | null = null;

  private readonly participantService = core.getService(ParticipantService);
  private readonly answerService = core.getService(ParticipantAnswerService);

  @state() private currentIndex = 0;
  @state() private isAutoPlaying = false;
  @state() private autoPlayTimer: number | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.loadAnswer();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAutoPlay();
  }

  private async loadAnswer() {
    if (!this.stage) return;

    const answer = this.answerService.getConversationReplayAnswer(
      this.stage.id,
    );

    if (answer) {
      this.currentIndex = answer.currentMessageIndex;

      // If already complete, show all messages
      if (answer.isComplete) {
        this.currentIndex = this.stage.messages.length;
      }
    } else {
      // Create initial answer
      await this.saveAnswer(
        createConversationReplayStageParticipantAnswer({id: this.stage.id}),
      );
    }

    // Start auto-play if configured
    if (this.stage.autoPlayDelayMs > 0 && !this.isComplete()) {
      this.startAutoPlay();
    }
  }

  private async saveAnswer(answer: ConversationReplayStageParticipantAnswer) {
    await this.answerService.updateConversationReplayAnswer(
      this.stage!.id,
      answer,
    );
  }

  private isComplete(): boolean {
    return this.currentIndex >= (this.stage?.messages.length ?? 0);
  }

  private startAutoPlay() {
    if (!this.stage || this.stage.autoPlayDelayMs === 0) return;

    this.isAutoPlaying = true;
    this.scheduleNextMessage();
  }

  private stopAutoPlay() {
    this.isAutoPlaying = false;
    if (this.autoPlayTimer !== null) {
      window.clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  private scheduleNextMessage() {
    if (!this.stage || !this.isAutoPlaying || this.isComplete()) {
      this.isAutoPlaying = false;
      return;
    }

    this.autoPlayTimer = window.setTimeout(() => {
      this.handleNext();
    }, this.stage.autoPlayDelayMs);
  }

  private async handleNext() {
    if (!this.stage || this.isComplete()) return;

    this.currentIndex++;

    const answer =
      this.answerService.getConversationReplayAnswer(this.stage.id) ??
      createConversationReplayStageParticipantAnswer({id: this.stage.id});

    answer.currentMessageIndex = this.currentIndex;
    answer.isComplete = this.isComplete();

    await this.saveAnswer(answer);

    // CRITICAL: Wait for the component to re-render with the new message
    await this.updateComplete;

    // Now scroll to show the new message
    this.scrollToBottom();

    // Schedule next message if auto-playing
    if (this.isAutoPlaying && !this.isComplete()) {
      this.scheduleNextMessage();
    }

    // Mark stage as complete when finished
    if (this.isComplete()) {
      this.stopAutoPlay();
      await this.participantService.progressToNextStage();
    }
  }

  private scrollToBottom() {
    // Double requestAnimationFrame to ensure everything is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = this.shadowRoot?.querySelector(
          '.messages-container',
        ) as HTMLElement;
        if (container) {
          console.log(
            'Scrolling! Container height:',
            container.scrollHeight,
            'Current scroll:',
            container.scrollTop,
          );
          // Set scroll position directly to the max
          container.scrollTop = container.scrollHeight;
          console.log('After scroll:', container.scrollTop);
        } else {
          console.error('Container not found!');
        }
      });
    });
  }

  private async handleReplay() {
    if (!this.stage || !this.stage.allowReplay) return;

    this.stopAutoPlay();
    this.currentIndex = 0;

    const answer =
      this.answerService.getConversationReplayAnswer(this.stage.id) ??
      createConversationReplayStageParticipantAnswer({id: this.stage.id});

    answer.currentMessageIndex = 0;
    answer.isComplete = false;
    answer.replayCount = (answer.replayCount ?? 0) + 1;

    await this.saveAnswer(answer);

    // Restart auto-play if configured
    if (this.stage.autoPlayDelayMs > 0) {
      this.startAutoPlay();
    }
  }

  private toggleAutoPlay() {
    if (!this.stage || this.stage.autoPlayDelayMs === 0) return;

    if (this.isAutoPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  }

  private renderMessage(message: ChatMessage, _index: number) {
    const profile = this.stage?.hideSenderInfo
      ? {name: 'Participant', avatar: '👤', pronouns: null}
      : message.profile;

    const showTimestamp = !this.stage?.hideTimestamps;

    return html`
      <div class="message-wrapper">
        <div class="message">
          <div class="message-header">
            <span class="avatar">${profile.avatar}</span>
            <span class="name">${profile.name}</span>
            ${showTimestamp
              ? html`<span class="timestamp">
                  ${message.timestamp.toDate?.().toLocaleTimeString() ?? ''}
                </span>`
              : nothing}
          </div>
          <div class="message-content">${message.message}</div>
        </div>
      </div>
    `;
  }

  private renderControls() {
    if (!this.stage) return nothing;

    const canAdvance = !this.isComplete();
    const canReplay = this.stage.allowReplay && this.isComplete();
    const showAutoPlayToggle = this.stage.autoPlayDelayMs > 0;
    const isComplete = this.isComplete();

    return html`
      <div class="controls">
        <div class="progress">
          ${isComplete
            ? 'Conversation complete!'
            : `Viewing message ${Math.min(this.currentIndex, this.stage.messages.length)} 
          of ${this.stage.messages.length}`}
        </div>

        <div class="buttons">
          ${showAutoPlayToggle && !isComplete
            ? html`
                <button class="auto-play-button" @click=${this.toggleAutoPlay}>
                  ${this.isAutoPlaying ? '⏸ Pause' : '▶ Auto-play'}
                </button>
              `
            : nothing}
          ${canAdvance && !this.isAutoPlaying
            ? html`
                <button
                  class="next-button primary-button"
                  @click=${this.handleNext}
                >
                  Next Message
                </button>
              `
            : nothing}
          ${isComplete
            ? html`
                <button
                  class="continue-button primary-button"
                  @click=${() => this.participantService.progressToNextStage()}
                >
                  Continue →
                </button>
              `
            : nothing}
          ${canReplay
            ? html`
                <button class="replay-button" @click=${this.handleReplay}>
                  ↻ Replay Conversation
                </button>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  override render() {
    if (!this.stage) {
      return html`<div>Loading...</div>`;
    }

    const visibleMessages = this.stage.messages.slice(0, this.currentIndex);

    return html`
      <div class="conversation-replay-container">
        <div class="messages-container">
          ${visibleMessages.length === 0
            ? html`<div class="no-messages">
                Click "Next Message" to begin viewing the conversation.
              </div>`
            : visibleMessages.map((msg, idx) => this.renderMessage(msg, idx))}
        </div>

        ${this.renderControls()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'conversation-replay-participant-view': ConversationReplayParticipantView;
  }
}
