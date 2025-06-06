"use client";

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { useConfig } from '@/src/app/config-context';
import { useToast } from '@/src/hooks/use-toast';
import { useSidebar } from '@/src/app/sidebar-context';

interface ConfigDialogProps {
  onConfigUpdate: (config: { superglueEndpoint: string; superglueApiKey: string }) => void;
}

export function ConfigDialog({ onConfigUpdate }: ConfigDialogProps) {
  const config = useConfig();
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    superglueEndpoint: config.superglueEndpoint || '',
    superglueApiKey: config.superglueApiKey || '',
  });
  const handleSave = () => {
    // 验证输入
    if (!formData.superglueEndpoint.trim()) {
      toast({
        title: "错误",
        description: "Superglue Endpoint 不能为空",
        variant: "destructive",
      });
      return;
    }

    if (!formData.superglueApiKey.trim()) {
      toast({
        title: "错误", 
        description: "Superglue API Key 不能为空",
        variant: "destructive",
      });
      return;
    }

    // 验证端点URL格式
    try {
      new URL(formData.superglueEndpoint);
    } catch {
      toast({
        title: "错误",
        description: "请输入有效的 Endpoint URL",
        variant: "destructive",
      });
      return;
    }

    // 保存到localStorage
    localStorage.setItem('superglue_config', JSON.stringify(formData));
    
    // 调用父组件的回调
    onConfigUpdate(formData);
    
    toast({
      title: "成功",
      description: "配置已保存",
    });
    
    setOpen(false);
  };
  const handleReset = () => {
    setFormData({
      superglueEndpoint: config.superglueEndpoint || '',
      superglueApiKey: config.superglueApiKey || '',
    });
  };

  return (    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          className={`${isCollapsed ? 'h-8 w-8' : 'w-full justify-start'} text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-secondary`}
        >
          <Settings className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && "配置设置"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>配置设置</DialogTitle>
          <DialogDescription>
            配置 Superglue 连接参数
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="endpoint">Superglue Endpoint</Label>
            <Input
              id="endpoint"
              value={formData.superglueEndpoint}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, superglueEndpoint: e.target.value }))
              }
              placeholder="http://localhost:4000"
              className="col-span-3"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apikey">API Key</Label>
            <Input
              id="apikey"
              type="password"
              value={formData.superglueApiKey}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, superglueApiKey: e.target.value }))
              }
              placeholder="输入您的 API Key"
              className="col-span-3"
            />
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            重置
          </Button>
          <Button onClick={handleSave}>
            保存配置
          </Button>        </div>
      </DialogContent>
    </Dialog>
  );
}
