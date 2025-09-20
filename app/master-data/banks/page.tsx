"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, CheckCircle, AlertCircle, X, Download, Search, Plus, MapPin, Building, Upload, Eye, FileText } from "lucide-react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { uploadToCloudinary, CloudinaryUploadResult } from '@/lib/cloudinary';
import { DataTable } from '@/components/data-table';
import type { Row } from '@tanstack/react-table';

interface BankLocation {
  id?: string;
  locationId: string;
  locationName: string;
  branchName: string;
  ifscCode: string;
  address?: string;
  authorizePerson1?: string;
  authorizePerson2?: string;
  uploadedFiles?: CloudinaryUploadResult[];
  createdAt?: string;
}

interface BankData {
  id?: string;
  bankId: string;
  bankName?: string;
  state: string;
  branch: string;
  locations: BankLocation[];
  createdAt?: string;
}

// Indian states list
const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", 
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", 
  "Ladakh", "Lakshadweep", "Puducherry"
];

export default function BankModulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // State management
  const [banks, setBanks] = useState<BankData[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<BankData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BankData>({
    bankId: '',
    state: '',
    branch: '',
    locations: [],
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankData | null>(null);
  const [locationFormData, setLocationFormData] = useState<BankLocation>({
    locationId: '',
    locationName: '',
    branchName: '',
    ifscCode: '',
    address: '',
    authorizePerson1: '',
    authorizePerson2: '',
    uploadedFiles: [],
  });
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // File upload states
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);
  const [viewingFiles, setViewingFiles] = useState<CloudinaryUploadResult[]>([]);

  // Define columns for DataTable (requirement #2: ascending order by bank code, #5: remove file count column)
  const bankColumns = useMemo(() => [
    {
      accessorKey: "bankId",
      header: "Bank Code",
      cell: ({ row }: { row: Row<any> }) => <span className="font-bold text-orange-800 w-full flex justify-center">{row.getValue("bankId") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "bankName",
      header: "Bank/Branch Name", 
      cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-medium w-full flex justify-center">{row.getValue("bankName") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-medium w-full flex justify-center">{row.getValue("state")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-medium w-full flex justify-center">{row.getValue("branch")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "locationId",
      header: "Location ID",
      cell: ({ row }: { row: Row<any> }) => <span className="text-blue-700 w-full flex justify-center">{row.getValue("locationId") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "locationName",
      header: "Location Name",
      cell: ({ row }: { row: Row<any> }) => <span className="text-blue-700 w-full flex justify-center">{row.getValue("locationName") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "branchName",
      header: "Branch Name",
      cell: ({ row }: { row: Row<any> }) => <span className="text-blue-700 w-full flex justify-center">{row.getValue("branchName") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "ifscCode",
      header: "IFSC Code",
      cell: ({ row }: { row: Row<any> }) => <span className="text-gray-600 w-full flex justify-center">{row.getValue("ifscCode") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "authorizePerson1",
      header: "Authorize Person 1",
      cell: ({ row }: { row: Row<any> }) => <span className="text-gray-600 w-full flex justify-center">{row.getValue("authorizePerson1") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "authorizePerson2",
      header: "Authorize Person 2",
      cell: ({ row }: { row: Row<any> }) => <span className="text-gray-600 w-full flex justify-center">{row.getValue("authorizePerson2") || '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "createdAt",
      header: "Created Date",
      cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("createdAt") ? new Date(row.getValue("createdAt")).toLocaleDateString() : '-'}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }: { row: Row<any> }) => {
        const rowData = row.original;
        return (
          <div className="flex space-x-2 justify-center">
            <Button
              size="sm"
              variant="outline"
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={() => handleAddLocationAction(rowData)}
              title="Add Location"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={() => handleEdit(rowData)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm" 
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${rowData.bankName || rowData.branch} and all its locations? This action cannot be undone.`)) {
                  handleDelete(rowData.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
      meta: { align: 'center' },
    },
  ], []);

  // Check if user has access
  useEffect(() => {
    if (user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user?.role, router]);

  const loadBanks = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'banks'));
      const banksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        locations: doc.data().locations || []
      })) as BankData[];
      setBanks(banksData);
      
      // Trigger cross-module reflection (requirement #8)
      // Dispatch custom event to notify other modules about bank data changes
      const bankUpdateEvent = new CustomEvent('bankDataUpdated', {
        detail: { banks: banksData, timestamp: new Date() }
      });
      window.dispatchEvent(bankUpdateEvent);
      
    } catch (error) {
      console.error('Error loading banks:', error);
      toast({
        title: "❌ Loading Failed", 
        description: "Failed to load banks. Please refresh the page.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const filterBanksBySearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredBanks(banks);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = banks.filter(bank =>
      bank.branch.toLowerCase().includes(searchLower) ||
      bank.state.toLowerCase().includes(searchLower) ||
      bank.bankId.toLowerCase().includes(searchLower) ||
      bank.locations.some(location => 
        location.locationName.toLowerCase().includes(searchLower) ||
        location.ifscCode.toLowerCase().includes(searchLower)
      )
    );

    setFilteredBanks(filtered);
  }, [banks, searchTerm]);

  // Load banks data
  useEffect(() => {
    loadBanks();
  }, []);

  // Filter banks based on search term
  useEffect(() => {
    filterBanksBySearch();
  }, [banks, searchTerm, filterBanksBySearch]);

  // Prepare table data - flatten bank-location pairs and sort by bank code (requirement #2)
  const tableData = useMemo(() => {
    const dataToDisplay = filteredBanks.length > 0 || searchTerm ? filteredBanks : banks;
    const flattened: any[] = [];
    
    // Sort banks by bankId first (requirement #2: ascending order by bank code)
    const sortedBanks = [...dataToDisplay].sort((a, b) => (a.bankId || '').localeCompare(b.bankId || ''));
    
    sortedBanks.forEach(bank => {
      if (bank.locations.length === 0) {
        // Bank without locations
        flattened.push({
          id: bank.id,
          bankId: bank.bankId,
          bankName: bank.bankName || bank.branch,
          state: bank.state,
          branch: bank.branch,
          locationId: '',
          locationName: '',
          branchName: '',
          ifscCode: '',
          authorizePerson1: '',
          authorizePerson2: '',
          createdAt: bank.createdAt,
          isBank: true,
          isLocation: false
        });
      } else {
        // Add bank row first
        flattened.push({
          id: bank.id,
          bankId: bank.bankId,
          bankName: bank.bankName || bank.branch,
          state: bank.state,
          branch: bank.branch,
          locationId: '',
          locationName: `${bank.locations.length} locations`,
          branchName: '',
          ifscCode: '',
          authorizePerson1: '',
          authorizePerson2: '',
          createdAt: bank.createdAt,
          isBank: true,
          isLocation: false,
          locationsCount: bank.locations.length
        });
        
        // Then add location rows sorted by location ID
        const sortedLocations = [...bank.locations].sort((a, b) => (a.locationId || '').localeCompare(b.locationId || ''));
        sortedLocations.forEach(location => {
          flattened.push({
            id: `${bank.id}-${location.locationId}`,
            bankId: '',
            bankName: bank.bankName || bank.branch,
            state: bank.state,
            branch: bank.branch,
            locationId: location.locationId,
            locationName: location.locationName,
            branchName: location.branchName,
            ifscCode: location.ifscCode,
            authorizePerson1: location.authorizePerson1,
            authorizePerson2: location.authorizePerson2,
            createdAt: location.createdAt,
            isBank: false,
            isLocation: true,
            parentBank: bank
          });
        });
      }
    });
    
    return flattened;
  }, [banks, filteredBanks, searchTerm]);

  // Action handlers for table events
  const handleAddLocationAction = (bank: BankData) => {
    console.log('Adding location for:', bank.branch);
    setSelectedBank(bank);
    setLocationFormData({
      locationId: '',
      locationName: '',
      branchName: '',
      ifscCode: '',
      address: '',
      authorizePerson1: '',
      authorizePerson2: '',
      uploadedFiles: [],
    });
    setShowAddLocationModal(true);
  };

  const handleEdit = (bank: BankData) => {
    console.log('Editing bank:', bank.branch);
    setFormData(bank);
    setEditingId(bank.id || null);
    setIsEditing(true);
    setShowAddBankModal(true);
  };

  const handleDelete = async (bankId: string) => {
    console.log('Deleting bank ID:', bankId);
    try {
      await deleteDoc(doc(db, 'banks', bankId));
      setSuccessMessage({
        title: "Bank Deleted Successfully! 🗑️",
        description: "The bank and all its locations have been permanently removed from the database."
      });
      setShowSuccessModal(true);
      loadBanks();
      
      // Auto close modal after 3 seconds for delete
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      toast({
        title: "❌ Delete Failed",
        description: "Failed to delete bank. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const exportToCSV = () => {
    const dataToExport = searchTerm.trim() ? filteredBanks : banks;
    
    if (dataToExport.length === 0) {
      toast({
        title: "❌ No Data to Export",
        description: "There are no banks to export.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Fixed headers - removed File Count and Location Created Date columns (requirements #4 & #5)
    const headers = [
      'Bank Code', 'Bank/Branch Name', 'State', 'Branch', 'Location ID', 'Location Name', 'Branch Name', 'IFSC Code', 'Authorize Person 1', 'Authorize Person 2', 'Address', 'Bank Created Date'
    ];

    const csvData = [headers];
    
    // Sort banks by bank code in ascending order for CSV (requirement #2)
    const sortedBanks = [...dataToExport].sort((a, b) => (a.bankId || '').localeCompare(b.bankId || ''));
    
    sortedBanks.forEach(bank => {
      if (bank.locations.length === 0) {
        // Bank without locations
        csvData.push([
          bank.bankId || '-',
          bank.bankName || bank.branch,
          bank.state || '',
          bank.branch || '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          bank.createdAt ? new Date(bank.createdAt).toLocaleDateString() : ''
        ]);
      } else {
        // Sort locations within each bank by locationId
        const sortedLocations = [...bank.locations].sort((a, b) => 
          (a.locationId || '').localeCompare(b.locationId || '')
        );
        
        sortedLocations.forEach(location => {
          csvData.push([
            bank.bankId || '-',
            bank.bankName || bank.branch,
            bank.state || '',
            bank.branch || '',
            location.locationId || '',
            location.locationName || '',
            location.branchName || '',
            location.ifscCode || '',
            location.authorizePerson1 || '',
            location.authorizePerson2 || '',
            location.address || '',
            bank.createdAt ? new Date(bank.createdAt).toLocaleDateString() : ''
          ]);
        });
      }
    });

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banks_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "✅ Export Successful",
      description: `${dataToExport.length} banks exported to CSV file.`,
      className: "bg-green-100 border-green-500 text-green-700",
      duration: 3000,
    });
  };

  // Generate unique bank ID
  const generateBankId = () => {
    if (banks.length === 0) {
      return 'BK-0001';
    }
    
    // Extract numbers from existing bank IDs and find the highest
    const existingNumbers = banks
      .map(bank => bank.bankId)
      .filter(id => id && id.startsWith('BK-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `BK-${nextNumber.toString().padStart(4, '0')}`;
  };

  // Generate unique location ID 
  const generateLocationId = () => {
    // Get all existing location IDs from all banks
    const allLocationIds: string[] = [];
    banks.forEach(bank => {
      bank.locations.forEach(location => {
        if (location.locationId) {
          allLocationIds.push(location.locationId);
        }
      });
    });

    const existingNumbers = allLocationIds
      .filter(id => id && id.startsWith('BK-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `BK-${nextNumber.toString().padStart(4, '0')}`;
  };

  const handleInputChange = (field: keyof BankData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationInputChange = (field: keyof BankLocation, value: string) => {
    // Special validation for IFSC code
    if (field === 'ifscCode') {
      // Convert to uppercase and limit to 11 characters
      const upperValue = value.toUpperCase().slice(0, 11);
      
      // Allow only alphanumeric characters
      if (!/^[A-Z0-9]*$/.test(upperValue)) {
        toast({
          title: "❌ Invalid Characters",
          description: "IFSC code can only contain letters and numbers",
          variant: "destructive",
          duration: 2000,
        });
        return;
      }
      
      // IFSC code validation: Should not be all numbers
      if (/^\d+$/.test(upperValue) && upperValue.length > 0) {
        toast({
          title: "❌ Invalid IFSC Code",
          description: "IFSC code cannot contain only numbers. Format: ABCD0123456",
          variant: "destructive",
          duration: 2000,
        });
        return; // Don't update the field
      }
      
      setLocationFormData(prev => ({ ...prev, [field]: upperValue }));
      return;
    }
    
    setLocationFormData(prev => ({ ...prev, [field]: value }));
  };

  // File upload functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "❌ No Files Selected",
        description: "Please select files to upload.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const uploadPromises = selectedFiles.map(file => uploadToCloudinary(file));
      const uploadResults = await Promise.all(uploadPromises);
      
      // Add uploaded files to location form data
      setLocationFormData(prev => ({
        ...prev,
        uploadedFiles: [...(prev.uploadedFiles || []), ...uploadResults]
      }));

      setSelectedFiles([]);
      // Reset file input
      const fileInput = document.getElementById('fileInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      toast({
        title: "✅ Upload Successful",
        description: `${uploadResults.length} file(s) uploaded successfully.`,
        className: "bg-green-100 border-green-500 text-green-700",
        duration: 3000,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "❌ Upload Failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewFiles = (files: CloudinaryUploadResult[]) => {
    setViewingFiles(files);
    setShowFileModal(true);
  };

  const handleRemoveFile = (fileIndex: number) => {
    setLocationFormData(prev => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles?.filter((_, index) => index !== fileIndex) || []
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const bankData = {
        ...formData,
        branch: formData.branch || '', // Initialize with empty branch for new banks
        createdAt: isEditing ? formData.createdAt : new Date().toISOString(),
      };

      if (isEditing && editingId) {
        // Update existing bank
        await updateDoc(doc(db, 'banks', editingId), bankData);
        setSuccessMessage({
          title: "Bank Updated Successfully! 🎉",
          description: `Bank in ${formData.state} has been updated in the system.`
        });
      } else {
        // Add new bank
        const newBankId = generateBankId();
        const newBankData = { ...bankData, bankId: newBankId };
        
        await addDoc(collection(db, 'banks'), newBankData);
        setSuccessMessage({
          title: "New Bank Added Successfully! 🎉",
          description: `Bank in ${formData.state} has been registered with Bank ID: ${newBankId}. You can now add locations to this bank.`
        });
      }

      setShowSuccessModal(true);
      
      // Close the add bank modal and reset form
      setShowAddBankModal(false);
      setFormData({
        bankId: '',
        state: '',
        branch: '',
        locations: [],
      });
      setIsEditing(false);
      setEditingId(null);
      loadBanks();
      
      // Auto close modal after 4 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 4000);
      
    } catch (error) {
      toast({
        title: "❌ Error Occurred",
        description: "Failed to save bank information. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBank) return;
    
    // Comprehensive IFSC Code Validation
    const ifscCode = locationFormData.ifscCode.trim();
    
    // Check if IFSC code is empty
    if (!ifscCode) {
      toast({
        title: "❌ IFSC Code Required",
        description: "Please enter a valid IFSC code",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    // Check if IFSC code is only numbers
    if (/^\d+$/.test(ifscCode)) {
      toast({
        title: "❌ Invalid IFSC Code Format",
        description: "IFSC code cannot contain only numbers. Format: ABCD0123456 (4 letters + 0 + 6 alphanumeric)",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    // Check IFSC code length
    if (ifscCode.length !== 11) {
      toast({
        title: "❌ Invalid IFSC Code Length",
        description: "IFSC code must be exactly 11 characters long. Format: ABCD0123456",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    // Check IFSC code format: 4 letters + 0 + 6 alphanumeric
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscPattern.test(ifscCode)) {
      toast({
        title: "❌ Invalid IFSC Code Format",
        description: "IFSC code should follow format: ABCD0123456 (4 letters + 0 + 6 alphanumeric characters)",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    // Check if IFSC code already exists (uniqueness validation)
    const isDuplicateIFSC = banks.some(bank => 
      bank.locations.some(location => {
        // Skip the current location if we're editing
        if (isEditingLocation && editingLocationId && location.locationId === editingLocationId) {
          return false;
        }
        return location.ifscCode.toUpperCase() === ifscCode.toUpperCase();
      })
    );
    
    if (isDuplicateIFSC) {
      toast({
        title: "❌ Duplicate IFSC Code",
        description: `IFSC code "${ifscCode}" already exists in the system. Each branch must have a unique IFSC code.`,
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let updatedLocations;
      let updatedBank;
      let successMsg;
      
      if (isEditingLocation && editingLocationId) {
        // Edit existing location
        updatedLocations = selectedBank.locations.map(location =>
          location.locationId === editingLocationId
            ? { ...locationFormData, createdAt: location.createdAt }
            : location
        );
        updatedBank = { 
          ...selectedBank, 
          locations: updatedLocations
        };
        successMsg = {
          title: "Branch Updated Successfully! ✅",
          description: `${locationFormData.branchName} branch has been updated in ${selectedBank.state}`
        };
      } else {
        // Add new location
        const newLocationId = generateLocationId();
        const newLocation: BankLocation = {
          ...locationFormData,
          locationId: newLocationId,
          createdAt: new Date().toISOString(),
        };
        updatedLocations = [...selectedBank.locations, newLocation];
        updatedBank = { 
          ...selectedBank, 
          locations: updatedLocations
        };
        successMsg = {
          title: "Branch Added Successfully! 📍",
          description: `${locationFormData.branchName} branch has been added to ${selectedBank.state} with Location ID: ${newLocationId}`
        };
      }
      
      await updateDoc(doc(db, 'banks', selectedBank.id!), updatedBank);
      
      setSuccessMessage(successMsg);
      setShowSuccessModal(true);
      setShowAddLocationModal(false);
      setLocationFormData({
        locationId: '',
        locationName: '',
        branchName: '',
        ifscCode: '',
        address: '',
        authorizePerson1: '',
        authorizePerson2: '',
        uploadedFiles: [],
      });
      setSelectedBank(null);
      setIsEditingLocation(false);
      setEditingLocationId(null);
      loadBanks();
      
      // Auto close modal after 4 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 4000);
      
    } catch (error) {
      toast({
        title: "❌ Error Occurred",
        description: `Failed to ${isEditingLocation ? 'update' : 'add'} branch. Please check your connection and try again.`,
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewBank = () => {
    // Reset form for new bank
    setFormData({
      bankId: '',
      state: '',
      branch: '',
      locations: [],
    });
    setIsEditing(false);
    setEditingId(null);
    setShowAddBankModal(true);
  };

  const handleCloseModal = () => {
    setShowAddBankModal(false);
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      bankId: '',
      state: '',
      branch: '',
      locations: [],
    });
  };

  const handleCloseLocationModal = () => {
    setShowAddLocationModal(false);
    setSelectedBank(null);
    setLocationFormData({
      locationId: '',
      locationName: '',
      branchName: '',
      ifscCode: '',
      address: '',
      authorizePerson1: '',
      authorizePerson2: '',
      uploadedFiles: [],
    });
    setIsEditingLocation(false);
    setEditingLocationId(null);
  };

  if (user?.role !== 'admin') return null;

  const displayBanks = searchTerm.trim() ? filteredBanks : banks;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.back()}
              className="inline-block text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
            >
              ← Dashboard
            </button>
          </div>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-6 py-3 bg-orange-100 rounded-lg">
              Bank Module
            </h1>
          </div>
          
          {/* Add Bank Button */}
          <Button
            onClick={handleAddNewBank}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 shadow-lg"
          >
            ✅ Add New Bank
          </Button>
        </div>

        {/* Search and Export Section */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-700">Search & Export Options</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2 flex-1 min-w-[300px]">
                <Search className="w-4 h-4 text-green-600" />
                <Label htmlFor="searchTerm" className="text-green-600 font-medium whitespace-nowrap">Search:</Label>
                <Input
                  id="searchTerm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by state, branch name, or IFSC..."
                  className="border-green-300 focus:border-green-500 flex-1"
                />
                {searchTerm && (
                  <Button
                    onClick={() => setSearchTerm('')}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <Button
                onClick={exportToCSV}
                className="bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            {searchTerm && (
              <div className="mt-3 text-sm text-green-600">
                {filteredBanks.length} banks found for &quot;{searchTerm}&quot;
              </div>
            )}
          </CardContent>
        </Card>

        {/* Banks Table with Enhanced DataTable */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-700">Registered Banks & Locations</CardTitle>
            {/* Entry count display (requirement #1: count below search bar) */}
            <div className="flex justify-between items-center mt-3">
              <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                <strong>Total Entries: {tableData.length}</strong> 
                {searchTerm && <span className="ml-2">(filtered from {banks.length})</span>}
              </div>
              <div className="text-xs text-gray-500">
                {tableData.length > 0 && "Showing entries in ascending order by bank code"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* DataTable with sticky features and pagination */}
            <DataTable
              columns={bankColumns}
              data={tableData}
              stickyHeader={true} // requirement #6: freeze top row header
              stickyFirstColumn={true} // requirement #7: freeze first column
              showGridLines={true}
              wrapperClassName="bank-datatable"
            />
          </CardContent>
        </Card>

        {/* Add/Edit Bank Modal */}
        <Dialog open={showAddBankModal} onOpenChange={setShowAddBankModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-orange-300">
            <DialogHeader>
              <DialogTitle className="text-orange-700 text-xl flex items-center gap-2">
                {isEditing ? '🔄 Edit Bank' : '✅ Add New Bank'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {isEditing ? 'Update bank information' : 'Enter state information for the bank (branches can be added separately)'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {/* State Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-green-600 font-medium">
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => handleInputChange('state', value)}
                    required
                  >
                    <SelectTrigger className="border-orange-300 focus:border-orange-500 text-orange-700 [&>span]:text-orange-700">
                      <SelectValue 
                        placeholder="Select state" 
                        className="text-orange-700"
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-60">
                      {indianStates.map(state => (
                        <SelectItem key={state} value={state} className="text-orange-700 hover:bg-orange-50">{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-blue-800 font-semibold mb-2">📝 Important Note:</h4>
                <p className="text-blue-700 text-sm">
                  After adding the state, you can add multiple branches with different bank names, locations and IFSC codes. 
                  Each branch will be associated with the selected state.
                </p>
              </div>

              {/* Modal Footer with Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={handleCloseModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting 
                    ? (isEditing ? '🔄 Updating...' : '⏳ Adding Bank...') 
                    : (isEditing ? '🔄 Update Bank' : '✅ Add Bank')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Location Modal */}
        <Dialog open={showAddLocationModal} onOpenChange={setShowAddLocationModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-blue-300">
            <DialogHeader>
              <DialogTitle className="text-blue-700 text-xl flex items-center gap-2">
                {isEditingLocation ? '🔄 Edit Branch' : '📍 Add New Branch'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {isEditingLocation ? 'Editing branch in' : 'Adding branch to'}: <strong>{selectedBank?.state}</strong>
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleLocationSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div className="space-y-2">
                  <Label htmlFor="bankName" className="text-green-600 font-medium">
                    Bank Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bankName"
                    value={locationFormData.locationName}
                    onChange={(e) => handleLocationInputChange('locationName', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., State Bank of India, HDFC Bank"
                    required
                  />
                  <p className="text-xs text-blue-600">Enter the bank name for this branch</p>
                </div>

                {/* Branch */}
                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-green-600 font-medium">
                    Branch <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="branch"
                    value={locationFormData.branchName}
                    onChange={(e) => handleLocationInputChange('branchName', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., Main Branch, City Center Branch"
                    required
                  />
                  <p className="text-xs text-blue-600">This branch will be displayed in the Branch column</p>
                </div>

                {/* IFSC Code */}
                <div className="space-y-2">
                  <Label htmlFor="ifscCode" className="text-green-600 font-medium">
                    IFSC Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ifscCode"
                    value={locationFormData.ifscCode}
                    onChange={(e) => handleLocationInputChange('ifscCode', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    maxLength={11}
                    placeholder="e.g., SBIN0001234"
                    required
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Format: 4 letters + 0 + 6 alphanumeric characters (e.g., SBIN0001234)
                  </p>
                </div>

                {/* Authorize Person 1 */}
                <div className="space-y-2">
                  <Label htmlFor="authorizePerson1" className="text-green-600 font-medium">
                    Authorize Person 1
                  </Label>
                  <Input
                    id="authorizePerson1"
                    value={locationFormData.authorizePerson1}
                    onChange={(e) => handleLocationInputChange('authorizePerson1', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., John Doe"
                  />
                </div>

                {/* Authorize Person 2 */}
                <div className="space-y-2">
                  <Label htmlFor="authorizePerson2" className="text-green-600 font-medium">
                    Authorize Person 2
                  </Label>
                  <Input
                    id="authorizePerson2"
                    value={locationFormData.authorizePerson2}
                    onChange={(e) => handleLocationInputChange('authorizePerson2', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., Jane Smith"
                  />
                </div>

                {/* Address (Optional) */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="text-green-600 font-medium">
                    Address (Optional)
                  </Label>
                  <Input
                    id="address"
                    value={locationFormData.address}
                    onChange={(e) => handleLocationInputChange('address', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., 123 Main Street, Near City Mall"
                  />
                </div>
              </div>

              {/* File Upload Section */}
              <div className="space-y-4 border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="text-blue-800 font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  📎 File Attachments
                </h4>
                
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      id="fileInput"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleFileUpload}
                    disabled={isUploading || selectedFiles.length === 0}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>⏳ Uploading...</>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="text-sm text-blue-600">
                    Selected: {selectedFiles.map(f => f.name).join(', ')}
                  </div>
                )}

                {/* Display uploaded files */}
                {locationFormData.uploadedFiles && locationFormData.uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-blue-700">Uploaded Files:</h5>
                    <div className="flex flex-wrap gap-2">
                      {locationFormData.uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                          <FileText className="w-4 h-4" />
                          <span>{file.original_filename}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 text-blue-600 hover:text-blue-800"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Info Display */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-green-800 font-semibold mb-2">🏦 Bank Information (Inherited):</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-700">Bank Name:</span>
                    <p className="text-green-600">{selectedBank?.state}</p>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">State:</span>
                    <p className="text-green-600">{selectedBank?.state}</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  The branch name you enter will be displayed in the Branch column of the table.
                </div>
              </div>

              {/* Modal Footer with Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={handleCloseLocationModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting 
                    ? (isEditingLocation ? '⏳ Updating Branch...' : '⏳ Adding Branch...') 
                    : (isEditingLocation ? '🔄 Update Branch' : '📍 Add Branch')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* File Viewing Modal */}
        <Dialog open={showFileModal} onOpenChange={setShowFileModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-blue-300">
            <DialogHeader>
              <DialogTitle className="text-blue-700 text-xl flex items-center gap-2">
                <FileText className="w-5 h-5" />
                📁 View Attached Files
              </DialogTitle>
              <DialogDescription className="text-green-600">
                Click on any file to open it in a new tab
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {viewingFiles.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No files attached</p>
              ) : (
                viewingFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer"
                       onClick={() => window.open(file.secure_url, '_blank')}>
                    <FileText className="w-6 h-6 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-700">{file.original_filename}</p>
                      <p className="text-sm text-gray-500">Format: {file.format.toUpperCase()}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-blue-300 text-blue-600 hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(file.secure_url, '_blank');
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setShowFileModal(false)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="border-green-300 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-green-700 flex items-center gap-3 text-xl">
                <CheckCircle className="w-6 h-6 text-green-500" />
                {successMessage.title}
              </DialogTitle>
              <DialogDescription className="text-gray-700 mt-3 text-base leading-relaxed">
                {successMessage.description}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setShowSuccessModal(false)}
                className="bg-green-500 hover:bg-green-600 text-white px-6"
              >
                ✅ Got it!
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
