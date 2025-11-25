// supabase/functions/ai-parser/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// --------------------------------------------------------------------------------
// ⚠️ 1. 配置你的 AI API Key (安全地从环境变量中读取)
// --------------------------------------------------------------------------------
// 注意: 真实的 API Key 会在下一步设置，这里只需要读取
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY'); 

// 检查 Key 是否存在，如果不存在，函数无法运行
if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set in environment variables.");
}

// --------------------------------------------------------------------------------
// 2. AI 核心指令 (The Accountant Prompt)
// --------------------------------------------------------------------------------
const ACCOUNTANT_PROMPT = `
你是一个专业的会计AI。你的任务是将用户提供的日常口语描述，转化为严格的JSON格式的记账交易数据。
**请严格遵守以下规则：**
1. 你的回答必须是纯JSON格式，不包含任何解释性文字或Markdown标识符（例如\`\`\`json）。
2. 使用的会计科目必须是通用的（例如：'主营业务收入', '交通费用', '管理费用'）。
3. 如果交易涉及欠款或预收款，'is_outstanding' 必须为 true，并识别出交易对象 ('counterparty')。
4. 金额必须为纯数字 (number)。
5. 如果用户没有指定金额，amount 设为 0。

**JSON 输出结构必须是：**
{
    "amount": number,            // 交易金额
    "is_income": boolean,        // true: 收入, false: 支出
    "category": string,          // 通用会计科目 (如: '交通费用', '餐饮招待', '业务收入')
    "is_outstanding": boolean,   // 是否为挂账/欠款
    "counterparty": string | null, // 交易对象名称
    "input_text": string         // 原始输入文本
}
`;

// --------------------------------------------------------------------------------
// 3. 处理函数 (Edge Function Logic)
// --------------------------------------------------------------------------------
serve(async (req) => {
    // 确保请求方法和内容类型正确
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    const { text } = await req.json();

    try {
        // 调用 OpenAI API (使用您偏好的LLM API，此处以OpenAI为例)
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // 使用便宜且快速的模型即可
                messages: [
                    { role: "system", content: ACCOUNTANT_PROMPT },
                    { role: "user", content: text }
                ],
                // 强制要求输出 JSON 格式
                response_format: { type: "json_object" } 
            }),
        });

        // 检查 API 调用是否成功
        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API Error:', errorText);
            return new Response(`OpenAI API Failed: ${response.statusText}`, { status: 500 });
        }

        const data = await response.json();
        const jsonResult = data.choices[0].message.content;

        // 返回 AI 解析的 JSON 结果
        return new Response(jsonResult, {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error('Function execution error:', error.message);
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
});