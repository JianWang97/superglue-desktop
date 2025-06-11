"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Trash2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast";

interface RequestBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  contentType?: string;
  onContentTypeChange?: (type: string) => void;
}

export default function RequestBodyEditor({
  value,
  onChange,
  disabled = false,
  contentType = "application/json",
  onContentTypeChange,
}: RequestBodyEditorProps) {
  const { toast } = useToast();
  const [bodyType, setBodyType] = useState<"json" | "xml" | "text">("json");

  // 从 contentType 推断 bodyType
  useEffect(() => {
    if (contentType.includes("json")) {
      setBodyType("json");
    } else if (contentType.includes("xml")) {
      setBodyType("xml");
    } else {
      setBodyType("text");
    }
  }, [contentType]);

  // 处理 bodyType 变更
  const handleBodyTypeChange = (newType: "json" | "xml" | "text") => {
    setBodyType(newType);
    
    // 更新 Content-Type
    if (onContentTypeChange) {
      switch (newType) {
        case "json":
          onContentTypeChange("application/json");
          break;
        case "xml":
          onContentTypeChange("application/xml");
          break;
        case "text":
          onContentTypeChange("text/plain");
          break;
      }
    }
  };

  // 格式化内容
  const formatContent = () => {
    try {
      if (bodyType === "json") {
        const parsed = JSON.parse(value || "{}");
        const formatted = JSON.stringify(parsed, null, 2);
        onChange(formatted);
        toast({
          title: "JSON 已格式化",
          description: "Request Body 已重新格式化",
        });
      } else if (bodyType === "xml") {
        // 简单的 XML 格式化
        const formatted = formatXml(value);
        onChange(formatted);
        toast({
          title: "XML 已格式化",
          description: "Request Body 已重新格式化",
        });
      }
    } catch (error) {
      toast({
        title: "格式化失败",
        description: bodyType === "json" ? "无效的 JSON 格式" : "无效的 XML 格式",
        variant: "destructive",
      });
    }
  };

  // 简单的 XML 格式化函数
  const formatXml = (xml: string): string => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "application/xml");
      const serializer = new XMLSerializer();
      let formatted = serializer.serializeToString(xmlDoc);
      
      // 基本的缩进格式化
      formatted = formatted.replace(/></g, '>\n<');
      const lines = formatted.split('\n');
      let indent = 0;
      const indentSize = 2;
      
      return lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('</')) {
          indent -= indentSize;
        }
        const indentedLine = ' '.repeat(Math.max(0, indent)) + trimmed;
        if (!trimmed.startsWith('</') && !trimmed.endsWith('/>') && trimmed.includes('<') && trimmed.includes('>')) {
          indent += indentSize;
        }
        return indentedLine;
      }).join('\n');
    } catch {
      return xml; // 如果格式化失败，返回原始内容
    }
  };

  // 清空内容
  const clearContent = () => {
    onChange("");
    toast({
      title: "Request Body 已清空",
      description: "Request Body 内容已清除",
    });
  };

  // 验证内容
  const validateContent = () => {
    if (!value) return null;
    
    try {
      if (bodyType === "json") {
        JSON.parse(value);
        return { isValid: true, type: "json" };
      } else if (bodyType === "xml") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(value, "application/xml");
        const hasError = doc.getElementsByTagName("parsererror").length > 0;
        return { isValid: !hasError, type: "xml" };
      }
    } catch {
      return { isValid: false, type: bodyType };
    }
    
    return { isValid: true, type: "text" };
  };

  // 获取内容预览
  const getContentPreview = () => {
    if (!value) return null;
    
    const validation = validateContent();
    if (!validation?.isValid) return null;
    
    try {
      if (bodyType === "json") {
        const parsed = JSON.parse(value);
        const keys = Object.keys(parsed);
        if (keys.length > 0) {
          return {
            type: "info",
            message: `包含字段: ${keys.join(", ")}${keys.length > 5 ? ` (还有 ${keys.length - 5} 个字段...)` : ""}`,
          };
        }
      } else if (bodyType === "xml") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(value, "application/xml");
        const rootElement = doc.documentElement;
        if (rootElement && rootElement.tagName !== "parsererror") {
          return {
            type: "info",
            message: `根元素: <${rootElement.tagName}>`,
          };
        }
      } else {
        const lines = value.split('\n').length;
        const chars = value.length;
        return {
          type: "info",
          message: `${lines} 行, ${chars} 个字符`,
        };
      }
    } catch {
      // 忽略错误
    }
    
    return null;
  };

  // 获取占位符文本
  const getPlaceholder = () => {
    switch (bodyType) {
      case "json":
        return '{"key": "value", "param": "{variable}"}';
      case "xml":
        return '<root>\n  <item>value</item>\n  <param>{variable}</param>\n</root>';
      case "text":
        return 'Enter plain text content...';
      default:
        return 'Enter request body content...';
    }
  };

  const validation = validateContent();
  const preview = getContentPreview();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">Request Body</Label>
          <Select
            value={bodyType}
            onValueChange={handleBodyTypeChange}
            disabled={disabled}
          >
            <SelectTrigger className="text-xs h-6 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
              <SelectItem value="text">Text</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {(bodyType === "json" || bodyType === "xml") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={formatContent}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              title={`格式化 ${bodyType.toUpperCase()}`}
              disabled={disabled}
            >
              格式化
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearContent}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
            title="清空内容"
            disabled={disabled}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            // 自动调整高度
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            const scrollHeight = target.scrollHeight;
            const minHeight = 64; // 最小高度 (约 4 行)
            const maxHeight = 300; // 最大高度
            target.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
          }}
          className="font-mono text-xs resize-none transition-all duration-200 min-h-[64px] max-h-[300px]"
          placeholder={getPlaceholder()}
          disabled={disabled}
          style={{
            height: 'auto',
            minHeight: '64px',
          }}
          onFocus={(e) => {
            // 获得焦点时重新计算高度
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            const scrollHeight = target.scrollHeight;
            target.style.height = `${Math.min(Math.max(scrollHeight, 64), 300)}px`;
          }}
        />
        
        {/* 验证状态指示器 */}
        {value && validation && (bodyType === "json" || bodyType === "xml") && (
          <div className="absolute top-2 right-2">
            <div 
              className={`w-2 h-2 rounded-full ${
                validation.isValid ? "bg-green-500" : "bg-red-500"
              }`} 
              title={validation.isValid ? `有效的 ${bodyType.toUpperCase()}` : `无效的 ${bodyType.toUpperCase()}`}
            />
          </div>
        )}
      </div>
      
      {/* 内容预览和错误提示 */}
      {value && (
        <>
          {preview && (
            <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded border-l-2 border-blue-400">
              <span className="font-medium">{preview.type === "info" ? "内容信息:" : ""}</span> {preview.message}
            </div>
          )}
          
          {validation && !validation.isValid && (bodyType === "json" || bodyType === "xml") && (
            <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border-l-2 border-red-400">
              <span className="font-medium">{bodyType.toUpperCase()} 语法错误:</span> 请检查格式是否正确
            </div>
          )}
        </>
      )}
    </div>
  );
}
