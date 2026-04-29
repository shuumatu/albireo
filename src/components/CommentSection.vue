<template>
  <div class="comment-section">
    <!-- 标题 -->
    <div class="cs-header">
      <h3 class="cs-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        评论
        <span v-if="commentCount > 0" class="cs-count">({{ commentCount }})</span>
      </h3>
    </div>

    <!-- 发表评论 -->
    <div class="cs-compose">
      <div class="cs-compose-avatar">{{ currentUsername?.charAt(0)?.toUpperCase() || '?' }}</div>
      <div class="cs-compose-body">
        <textarea
          v-model="newContent"
          class="cs-textarea"
          placeholder="写下你的评论..."
          rows="3"
          :maxlength="1000"
        ></textarea>
        <div class="cs-compose-footer">
          <span class="cs-char-count">{{ newContent.length }}/1000</span>
          <button class="cs-btn cs-btn-primary" :disabled="!newContent.trim() || submitting" @click="handleSubmit">
            {{ submitting ? '发送中...' : '发表评论' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="cs-state">
      <div class="cs-spinner"></div>
      <span class="cs-state-text">加载评论中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="comments.length === 0" class="cs-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="cs-state-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="cs-state-text">暂无评论，来发表第一条评论吧</span>
    </div>

    <!-- 评论列表 -->
    <div v-else class="cs-list">
      <div v-for="comment in comments" :key="comment.id" class="cs-item">
        <!-- 顶级评论 -->
        <div class="cs-comment">
          <div class="cs-avatar">{{ comment.username?.charAt(0)?.toUpperCase() || '?' }}</div>
          <div class="cs-body">
            <div class="cs-meta">
              <span class="cs-username">{{ comment.username }}</span>
              <span class="cs-time">{{ formatTime(comment.createdAt) }}</span>
              <button
                v-if="canDelete(comment)"
                class="cs-btn-icon cs-btn-delete"
                title="删除评论"
                @click="handleDelete(comment.id)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
            <p class="cs-content">{{ comment.content }}</p>
            <button class="cs-btn-text" @click="toggleReply(comment.id)">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              回复
            </button>

            <!-- 内联回复框 -->
            <div v-if="replyingTo === comment.id" class="cs-reply-compose">
              <textarea
                v-model="replyContent"
                class="cs-textarea cs-textarea-sm"
                :placeholder="'回复 ' + comment.username + '...'"
                rows="2"
                :maxlength="1000"
              ></textarea>
              <div class="cs-compose-footer">
                <span class="cs-char-count">{{ replyContent.length }}/1000</span>
                <div class="cs-btn-group">
                  <button class="cs-btn cs-btn-ghost" @click="cancelReply">取消</button>
                  <button class="cs-btn cs-btn-primary cs-btn-sm" :disabled="!replyContent.trim() || submitting" @click="handleReply(comment.id)">
                    {{ submitting ? '发送中...' : '回复' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 回复列表 -->
        <div v-if="comment.replies && comment.replies.length > 0" class="cs-replies">
          <div v-for="reply in comment.replies" :key="reply.id" class="cs-comment cs-comment-reply">
            <div class="cs-avatar cs-avatar-sm">{{ reply.username?.charAt(0)?.toUpperCase() || '?' }}</div>
            <div class="cs-body">
              <div class="cs-meta">
                <span class="cs-username">{{ reply.username }}</span>
                <span class="cs-time">{{ formatTime(reply.createdAt) }}</span>
                <button
                  v-if="canDelete(reply)"
                  class="cs-btn-icon cs-btn-delete"
                  title="删除回复"
                  @click="handleDelete(reply.id)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
              <p class="cs-content">{{ reply.content }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { CommentTargetType, CommentVO } from '../types/comment'
import { createComment, deleteComment, getCommentCount, getComments } from '../api/comment'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const props = defineProps<{
  targetType: CommentTargetType
  targetId: string
}>()

const comments = ref<CommentVO[]>([])
const commentCount = ref(0)
const loading = ref(false)
const submitting = ref(false)
const newContent = ref('')
const replyingTo = ref<number | null>(null)
const replyContent = ref('')

const currentUserId = Number(localStorage.getItem('userId')) || 0
const currentUsername = localStorage.getItem('username') || ''
const currentRole = localStorage.getItem('role') || ''

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  return dayjs(dateStr).fromNow()
}

function canDelete(comment: CommentVO): boolean {
  return comment.userId === currentUserId || currentRole === 'ADMIN'
}

function toggleReply(commentId: number) {
  if (replyingTo.value === commentId) {
    cancelReply()
  } else {
    replyingTo.value = commentId
    replyContent.value = ''
  }
}

function cancelReply() {
  replyingTo.value = null
  replyContent.value = ''
}

async function fetchComments() {
  loading.value = true
  try {
    const [list, count] = await Promise.all([
      getComments(props.targetType, props.targetId),
      getCommentCount(props.targetType, props.targetId)
    ])
    comments.value = list
    commentCount.value = count
  } catch (e) {
    console.error('获取评论失败:', e)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!newContent.value.trim() || submitting.value) return
  submitting.value = true
  try {
    await createComment({
      targetType: props.targetType,
      targetId: props.targetId,
      content: newContent.value.trim()
    })
    newContent.value = ''
    await fetchComments()
  } catch (e) {
    console.error('发表评论失败:', e)
  } finally {
    submitting.value = false
  }
}

async function handleReply(parentId: number) {
  if (!replyContent.value.trim() || submitting.value) return
  submitting.value = true
  try {
    await createComment({
      targetType: props.targetType,
      targetId: props.targetId,
      content: replyContent.value.trim(),
      parentId
    })
    cancelReply()
    await fetchComments()
  } catch (e) {
    console.error('回复失败:', e)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: number) {
  if (!confirm('确定要删除这条评论吗？')) return
  try {
    await deleteComment(id)
    await fetchComments()
  } catch (e) {
    console.error('删除评论失败:', e)
  }
}

onMounted(() => {
  fetchComments()
})
</script>

<style scoped>
.comment-section { margin-top: 0; }

/* 标题 */
.cs-header { margin-bottom: 20px; }

.cs-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1E2A24;
}

.cs-title svg { color: #4CAF7D; }

.cs-count {
  font-weight: 400;
  color: #8FA89A;
  font-size: 15px;
}

/* 发表评论区 */
.cs-compose {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #D4E8DC;
}

.cs-compose-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF7D, #81C784);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.cs-compose-body { flex: 1; min-width: 0; }

.cs-textarea {
  width: 100%;
  padding: 12px 14px;
  background: #F0F9F4;
  border: 1px solid #B8D9C4;
  border-radius: 10px;
  color: #1E2A24;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  box-sizing: border-box;
}

.cs-textarea::placeholder { color: #8FA89A; }

.cs-textarea:focus {
  border-color: #4CAF7D;
  background: #fff;
}

.cs-textarea-sm { padding: 10px 12px; font-size: 13px; }

.cs-compose-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.cs-char-count { font-size: 12px; color: #8FA89A; }
.cs-btn-group { display: flex; gap: 8px; }

/* 按钮 */
.cs-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  font-family: inherit;
  line-height: 1;
}

.cs-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.cs-btn-primary { background: #4CAF7D; color: #fff; }
.cs-btn-primary:not(:disabled):hover { background: #3D9B6A; }

.cs-btn-ghost { background: #E8F5EE; color: #5F7A6A; border: 1px solid #B8D9C4; }
.cs-btn-ghost:hover { background: #D4EDE0; }

.cs-btn-sm { padding: 6px 14px; font-size: 12px; }

.cs-btn-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #4CAF7D;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.2s;
}

.cs-btn-text:hover { color: #3D9B6A; }

.cs-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s, color 0.2s;
  color: #8FA89A;
  margin-left: auto;
}

.cs-btn-delete:hover { color: #e53e3e; background: rgba(229, 62, 62, 0.08); }

/* 状态 */
.cs-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
}

.cs-state-icon { color: #B8D9C4; }
.cs-state-text { font-size: 13px; color: #8FA89A; }

.cs-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #D4E8DC;
  border-top-color: #4CAF7D;
  border-radius: 50%;
  animation: cs-spin 0.7s linear infinite;
}

@keyframes cs-spin { to { transform: rotate(360deg); } }

/* 评论列表 */
.cs-list { display: flex; flex-direction: column; }

.cs-item {
  padding: 16px 0;
  border-bottom: 1px solid #E0EDE5;
}

.cs-item:last-child { border-bottom: none; padding-bottom: 0; }

/* 单条评论 */
.cs-comment { display: flex; gap: 12px; }

.cs-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF7D, #81C784);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.cs-avatar-sm { width: 26px; height: 26px; font-size: 11px; }

.cs-body { flex: 1; min-width: 0; }

.cs-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.cs-username { font-size: 13px; font-weight: 600; color: #1E2A24; }
.cs-time { font-size: 12px; color: #8FA89A; }

.cs-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #3D5248;
  word-break: break-word;
}

/* 回复区域 */
.cs-replies {
  margin-left: 46px;
  margin-top: 12px;
  padding-left: 16px;
  border-left: 2px solid #C8E6D4;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cs-comment-reply .cs-content { font-size: 13px; }
.cs-reply-compose { margin-top: 10px; }

@media (max-width: 640px) {
  .cs-replies { margin-left: 36px; padding-left: 12px; }
  .cs-title { font-size: 15px; }
}
</style>
