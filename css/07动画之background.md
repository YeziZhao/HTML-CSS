# 1. 什么是background
background是用于集中定义各种背景属性。例如背景的color, size, origin,size,repeat等。其中的属性顺序可以按任意顺序放置。<br>
| 参数  | 说明 | 实例   |
|-------|-------|-------|
| background-attachment| 决定背景图像的位置是在视口内固定, 或者随着包含它的区块滚动| fixed: 背景相对`视窗固定`，即使元素拥有滚动机制，背景也不会随着元素滚动。相当于背景设置在body身上<br>local:表示背景相对于`元素的内容`固定,如果元素拥有滚动机制，背景将随着元素内容滚动。<br>scroll:景相对于元素本身固定，而不是随着它的内容滚动 |

## 1.1 background-attachment
